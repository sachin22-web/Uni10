import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const WISHLIST_STORAGE_KEY = 'uni_wishlist_ids';

export function useWishlist() {
  const { user } = useAuth();
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Load wishlist only once on mount, or when user ID changes
  useEffect(() => {
    let ignore = false;

    const loadWishlist = async () => {
      setLoading(true);
      try {
        if (user?._id) {
          // Load from server only if user is authenticated
          const result = await api('/api/wishlist');
          if (!ignore) {
            if (result?.ok && Array.isArray(result?.json?.data)) {
              const ids = new Set(
                result.json.data.map((item: any) => String(item.productId || item.product_id || ''))
              );
              setWishlistIds(ids);
              try {
                localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(Array.from(ids)));
              } catch (e) {
                console.warn('Failed to save wishlist to localStorage', e);
              }
            } else {
              // Fallback to localStorage on any error
              loadFromStorage();
            }
          }
        } else {
          // Load from localStorage when not authenticated
          if (!ignore) {
            loadFromStorage();
          }
        }
      } finally {
        if (!ignore) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    loadWishlist();
    return () => {
      ignore = true;
    };
  }, [user?._id]);

  const loadFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem(WISHLIST_STORAGE_KEY);
      if (stored) {
        const ids = new Set(JSON.parse(stored));
        setWishlistIds(ids);
      } else {
        setWishlistIds(new Set());
      }
    } catch (e) {
      console.warn('Failed to load wishlist from localStorage', e);
      setWishlistIds(new Set());
    }
  }, []);

  const isInWishlist = useCallback((productId: string): boolean => {
    return wishlistIds.has(String(productId));
  }, [wishlistIds]);

  const addToWishlist = useCallback(async (productId: string) => {
    const id = String(productId);
    
    if (wishlistIds.has(id)) {
      toast.error('Already in wishlist');
      return;
    }

    try {
      if (user?._id) {
        // Add via server
        try {
          const result = await api('/api/wishlist', {
            method: 'POST',
            body: JSON.stringify({ productId: id }),
          });
          if (result?.ok) {
            setWishlistIds((prev) => new Set([...prev, id]));
            try {
              localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(Array.from(new Set([...wishlistIds, id]))));
            } catch (e) {
              console.warn('Failed to save to localStorage', e);
            }
            toast.success('Added to wishlist');
          } else {
            throw new Error(result?.json?.message || 'Failed to add');
          }
        } catch (e: any) {
          console.warn('Failed to add to server, using localStorage:', e);
          const updated = new Set([...wishlistIds, id]);
          setWishlistIds(updated);
          try {
            localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(Array.from(updated)));
          } catch (e2) {
            console.warn('Failed to save to localStorage', e2);
          }
          toast.success('Added to wishlist');
        }
      } else {
        // Add to localStorage
        const updated = new Set([...wishlistIds, id]);
        setWishlistIds(updated);
        try {
          localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(Array.from(updated)));
        } catch (e) {
          console.warn('Failed to save to localStorage', e);
        }
        toast.success('Added to wishlist');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add to wishlist');
    }
  }, [user?._id, wishlistIds]);

  const removeFromWishlist = useCallback(async (productId: string) => {
    const id = String(productId);
    
    if (!wishlistIds.has(id)) {
      return;
    }

    try {
      if (user?._id) {
        // Remove from server
        try {
          const result = await api(`/api/wishlist/${id}`, {
            method: 'DELETE',
          });
          if (result?.ok) {
            const updated = new Set(wishlistIds);
            updated.delete(id);
            setWishlistIds(updated);
            try {
              localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(Array.from(updated)));
            } catch (e) {
              console.warn('Failed to save to localStorage', e);
            }
            toast.success('Removed from wishlist');
          } else {
            throw new Error(result?.json?.message || 'Failed to remove');
          }
        } catch (e: any) {
          console.warn('Failed to remove from server, using localStorage:', e);
          const updated = new Set(wishlistIds);
          updated.delete(id);
          setWishlistIds(updated);
          try {
            localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(Array.from(updated)));
          } catch (e2) {
            console.warn('Failed to save to localStorage', e2);
          }
          toast.success('Removed from wishlist');
        }
      } else {
        // Remove from localStorage
        const updated = new Set(wishlistIds);
        updated.delete(id);
        setWishlistIds(updated);
        try {
          localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(Array.from(updated)));
        } catch (e) {
          console.warn('Failed to save to localStorage', e);
        }
        toast.success('Removed from wishlist');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to remove from wishlist');
    }
  }, [user?._id, wishlistIds]);

  const toggleWishlist = useCallback(async (productId: string) => {
    const id = String(productId);
    if (wishlistIds.has(id)) {
      await removeFromWishlist(id);
    } else {
      await addToWishlist(id);
    }
  }, [wishlistIds, addToWishlist, removeFromWishlist]);

  return {
    wishlistIds,
    loading,
    isInWishlist,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
  };
}
