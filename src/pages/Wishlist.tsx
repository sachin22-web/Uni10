import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useWishlist } from '@/hooks/useWishlist';
import { api } from '@/lib/api';

type ProductRow = {
  _id?: string;
  id?: string;
  title?: string;
  name?: string;
  price?: number;
  category?: string;
  stock?: number;
  image_url?: string;
  images?: string[];
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const resolveImage = (src?: string) => {
  const s = String(src || '');
  if (!s) return '/placeholder.svg';
  if (s.startsWith('http')) return s;
  const isLocalBase = (() => { try { return API_BASE.includes('localhost') || API_BASE.includes('127.0.0.1'); } catch { return false; } })();
  const isHttpsPage = (() => { try { return location.protocol === 'https:'; } catch { return false; } })();
  if (s.startsWith('/uploads') || s.startsWith('uploads')) {
    if (API_BASE && !(isLocalBase && isHttpsPage)) {
      const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
      return s.startsWith('/') ? `${base}${s}` : `${base}/${s}`;
    }
  }
  return s;
};

const Wishlist = () => {
  const [wishlistProducts, setWishlistProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { wishlistIds, removeFromWishlist } = useWishlist();
  const navigate = useNavigate();

  useEffect(() => {
    fetchWishlistProducts();
  }, [wishlistIds, user]);

  const fetchWishlistProducts = async () => {
    try {
      setLoading(true);
      
      if (wishlistIds.size === 0) {
        setWishlistProducts([]);
        return;
      }

      const { ok, json } = await api('/api/products?limit=200');
      if (!ok) throw new Error(json?.message || json?.error || 'Failed to load products');
      
      const allProducts = Array.isArray(json?.data) ? json.data : [];
      const products = allProducts.filter((p: ProductRow) => {
        const id = String(p._id || p.id || '');
        return wishlistIds.has(id);
      });

      setWishlistProducts(products);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load wishlist');
      setWishlistProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = (productId: string) => {
    removeFromWishlist(productId);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-3 sm:px-4 pt-24 pb-12">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-4xl md:text-6xl font-black tracking-tighter mb-2 sm:mb-4">
            My <span className="text-primary">Wishlist</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Your saved items</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-sm">Loading wishlist...</div>
        ) : wishlistProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xs sm:text-sm text-muted-foreground mb-4">Your wishlist is empty</p>
            <Button onClick={() => navigate('/shop')} className="text-xs sm:text-sm">Browse Products</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            {wishlistProducts.map((product) => {
              const id = String(product._id || product.id || '');
              const title = product.title || product.name || '';
              const rawImg = product.image_url || (Array.isArray(product.images) ? product.images[0] : '') || '/placeholder.svg';
              const img = resolveImage(rawImg);

              return (
                <Card
                  key={id}
                  className="group overflow-hidden bg-card border-border hover:border-primary/50 transition-all duration-300"
                >
                  <Link to={`/product/${id}`}>
                    <div className="aspect-square overflow-hidden bg-secondary relative">
                      <img
                        src={img}
                        alt={title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemove(id); }}
                        className="absolute top-3 right-3 p-2 bg-background/80 hover:bg-background rounded-full transition-all duration-200"
                      >
                        <Heart
                          className="h-4 w-4 sm:h-5 sm:w-5"
                          fill="rgb(239, 68, 68)"
                          color="rgb(239, 68, 68)"
                        />
                      </button>
                    </div>
                  </Link>
                  <div className="p-3 sm:p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      {product.category || 'Uncategorized'}
                    </p>
                    <Link to={`/product/${id}`}>
                      <h3 className="font-semibold text-xs sm:text-base mb-2 group-hover:text-primary transition-colors line-clamp-2">{title}</h3>
                    </Link>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm sm:text-lg font-bold">
                        ₹{Number(product.price || 0).toLocaleString('en-IN')}
                      </p>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemove(id); }}
                        className="h-8 w-8 sm:h-10 sm:w-10"
                      >
                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Wishlist;
