import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  id: string;
  title: string;
  price: number;
  image?: string;
  qty: number;
  meta?: Record<string, any>;
};

export type AppliedCoupon = {
  code: string;
  discount: number;
};

type CartContextType = {
  items: CartItem[];
  count: number;
  subtotal: number;
  discountAmount: number;
  total: number;
  appliedCoupon: AppliedCoupon | null;
  addToCart: (item: Omit<CartItem, "qty">, qty?: number) => void;
  updateQty: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  applyCoupon: (coupon: AppliedCoupon) => void;
  removeCoupon: () => void;
  placeOrder: (payload: any) => Promise<{ ok: boolean; data?: any; error?: any }>;
};

const STORAGE_KEY = "uni_cart_v1";
const LEGACY_KEY = "cart_v1";
const CartContext = createContext<CartContextType | undefined>(undefined);

function readStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CartItem[];
  } catch (e) {
    console.error("Failed to read cart from storage", e);
    return [];
  }
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => (typeof window !== "undefined" ? readStorage() : []));
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  useEffect(() => {
    try {
      const str = JSON.stringify(items);
      localStorage.setItem(STORAGE_KEY, str);
      // keep legacy key in sync for compatibility
      localStorage.setItem(LEGACY_KEY, str);
    } catch (e) {
      console.error("Failed to save cart", e);
    }
  }, [items]);

  const addToCart = (item: Omit<CartItem, "qty">, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((p) => p.id === item.id && JSON.stringify(p.meta || {}) === JSON.stringify(item.meta || {}));
      if (existing) {
        return prev.map((p) => (p.id === existing.id ? { ...p, qty: p.qty + qty } : p));
      }
      return [...prev, { ...item, qty }];
    });
  };

  const updateQty = (id: string, qty: number) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, qty: Math.max(1, qty) } : p)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  };

  const clearCart = () => {
    setItems([]);
    setAppliedCoupon(null);
  };

  const applyCoupon = (coupon: AppliedCoupon) => {
    setAppliedCoupon(coupon);
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  const count = useMemo(() => items.reduce((s, it) => s + it.qty, 0), [items]);
  const subtotal = useMemo(() => items.reduce((s, it) => s + it.qty * Number(it.price || 0), 0), [items]);
  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    return Math.round((subtotal * appliedCoupon.discount) / 100);
  }, [subtotal, appliedCoupon]);
  const total = useMemo(() => Math.max(0, subtotal - discountAmount), [subtotal, discountAmount]);

  const placeOrder = async (payload: any) => {
    try {
      const { api } = await import('@/lib/api');
      const orderPayload = {
        name: payload.name || payload.customer?.name,
        phone: payload.phone || payload.customer?.phone,
        address: payload.address || payload.customer?.address,
        city: payload.city || payload.customer?.city,
        state: payload.state || payload.customer?.state,
        pincode: payload.pincode || payload.customer?.pincode,
        paymentMethod: payload.paymentMethod || 'COD',
        items: payload.items,
        total: payload.total,
        status: payload.status || 'pending',
        upi: payload.upi,
      };
      const res = await api('/api/orders', { method: 'POST', body: JSON.stringify(orderPayload) });
      if (res.ok && res.json?.ok) return { ok: true, data: res.json.data };
      // backend didn't accept — fallback to local order
      const localId = 'local_order_' + Date.now();
      try {
        const raw = localStorage.getItem('uni_orders_v1');
        const arr = raw ? (JSON.parse(raw) as any[]) : [];
        const order = { _id: localId, ...orderPayload, createdAt: new Date().toISOString() };
        localStorage.setItem('uni_orders_v1', JSON.stringify([order, ...arr]));
        localStorage.setItem('uni_last_order_id', localId);
      } catch (e) {
        console.error('Failed to persist local order', e);
      }
      return { ok: true, data: { id: localId } };
    } catch (error) {
      return { ok: false, error };
    }
  };

  return (
    <CartContext.Provider value={{ items, addToCart, updateQty, removeItem, clearCart, count, subtotal, discountAmount, total, appliedCoupon, applyCoupon, removeCoupon, placeOrder }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
