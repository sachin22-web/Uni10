import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { CheckoutModal } from "@/components/CheckoutModal";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Types for orders and items
type OrderItem = { id: string; title: string; price: number; qty: number; image?: string };
export type Order = {
  _id: string;
  total: number;
  payment?: string;
  paymentMethod?: string;
  upi?: { payerName?: string; txnId?: string };
  status: "pending" | "paid" | "shipped" | "delivered" | "returned" | "cancelled" | string;
  createdAt: string;
  updatedAt?: string;
  deliveredAt?: string;
  items: OrderItem[];
};

type OrdersResponse = { ok: boolean; data?: Order[] };

const LS_ORDERS = "uni_orders_v1";
const LS_CART = "uni_cart_v1";
const LS_LAST = "uni_last_order_id";

const statuses = [
  "All",
  "Pending",
  "Cod Pending",
  "Pending Verification",
  "Verified",
  "Shipped",
  "Delivered",
  "Returned",
  "Cancelled",
] as const;

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString();
}

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const { items: cartItems, addToCart, count } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation() as any;

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [filter, setFilter] = useState<(typeof statuses)[number]>("All");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showCount, setShowCount] = useState(10);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [openCheckout, setOpenCheckout] = useState(false);
  const [activeTab, setActiveTab] = useState<"orders" | "returns" | "cart" | "wishlist">("orders");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Protect route
  useEffect(() => {
    if (loading) return;
    if (!user) navigate("/auth", { replace: true });
  }, [loading, user, navigate]);

  // Load orders with progressive enhancement
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoadingOrders(true);
      let list: Order[] = [];
      try {
        const res = (await api("/api/orders/mine")) as { ok: boolean; json: OrdersResponse } & any;
        if (res.ok && res.json?.ok && Array.isArray(res.json.data)) {
          list = res.json.data as Order[];
        }
      } catch {}
      if (!list.length) {
        try {
          const raw = localStorage.getItem(LS_ORDERS);
          list = raw ? (JSON.parse(raw) as Order[]) : [];
        } catch {
          list = [];
        }
      }
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      if (!cancelled) setOrders(list);
      if (!cancelled) setLoadingOrders(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Highlight last placed order once
  useEffect(() => {
    const fromState = location?.state?.lastOrderId as string | undefined;
    const fromLS = localStorage.getItem(LS_LAST) || undefined;
    const id = fromState || fromLS || null;
    if (id) {
      setHighlightId(id);
      localStorage.removeItem(LS_LAST);
      const t = setTimeout(() => setHighlightId(null), 4000);
      return () => clearTimeout(t);
    }
  }, [location?.state]);

  // Handle checkout query parameter
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("checkout") === "true") {
      setOpenCheckout(true);
      // Clean up URL
      navigate(location.pathname, { replace: true });
    }
  }, [location.search]);

  // Compute filtered and paginated orders
  const filtered = useMemo(() => {
    if (filter === "All") return orders;
    const f = filter.toLowerCase().replace(/\s+/g, "_");
    return orders.filter((o) => (o.status || "").toLowerCase() === f);
  }, [orders, filter]);
  const visible = filtered.slice(0, showCount);

  // Cart snapshot (up to 5 items), with localStorage fallback
  const cartSnapshot: OrderItem[] = useMemo(() => {
    if (cartItems && cartItems.length)
      return cartItems.slice(0, 5).map((i) => ({ id: i.id, title: i.title, price: i.price, qty: i.qty, image: i.image }));
    try {
      const raw = localStorage.getItem(LS_CART) || localStorage.getItem("cart_v1");
      const arr = raw ? (JSON.parse(raw) as any[]) : [];
      return (arr as OrderItem[]).slice(0, 5);
    } catch {
      return [];
    }
  }, [cartItems]);
  const cartSubtotal = useMemo(() => cartSnapshot.reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 0), 0), [cartSnapshot]);

  const toggleExpand = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const reorder = (order: Order) => {
    order.items.forEach((it) => addToCart({ id: it.id, title: it.title, price: it.price, image: it.image }));
    toast({ title: "Added to cart", description: `Reordered ${order.items.length} item(s)` });
  };

  const statusBadge = (s: string) => {
    const base = "px-2 py-0.5 rounded text-xs font-medium capitalize";
    const map: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 border border-yellow-200",
      cod_pending: "bg-yellow-100 text-yellow-800 border border-yellow-200",
      pending_verification: "bg-orange-100 text-orange-800 border border-orange-200",
      verified: "bg-green-100 text-green-800 border border-green-200",
      paid: "bg-green-100 text-green-800 border border-green-200",
      shipped: "bg-blue-100 text-blue-800 border border-blue-200",
      delivered: "bg-emerald-100 text-emerald-800 border border-emerald-200",
      returned: "bg-purple-100 text-purple-800 border border-purple-200",
      cancelled: "bg-red-100 text-red-800 border border-red-200",
    };
    return <span className={`${base} ${map[(s || "").toLowerCase()] || "bg-muted text-foreground/80"}`}>{s}</span>;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter">Welcome{user?.name ? `, ${user.name}` : ""}</h1>
            <p className="text-muted-foreground text-sm">Manage your account</p>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/cart" className="relative inline-flex items-center">
              <span className="text-sm mr-2">Cart Items:</span>
              <span className="bg-primary text-primary-foreground rounded-full px-2 py-1 text-xs font-bold">{count}</span>
            </Link>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await signOut();
                  navigate("/");
                  toast({ title: "Signed out" });
                } catch {
                  navigate("/");
                }
              }}
            >
              Logout
            </Button>
          </div>
        </div>

        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="md:hidden mb-4 p-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors flex items-center gap-2"
        >
          {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          <span className="text-sm font-medium">
            {isSidebarOpen ? 'Close' : 'Menu'}
          </span>
        </button>

        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          {/* Sidebar - collapsible on mobile */}
          <aside
            className={cn(
              'transition-all duration-300 ease-in-out',
              'w-full md:w-56',
              isSidebarOpen ? 'block' : 'hidden md:block'
            )}
          >
            <div className="bg-card border border-border rounded-lg p-3 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
              <div className="text-sm font-semibold text-muted-foreground mb-2">Dashboard</div>
              <div className="space-y-1">
                <Link
                  to="/dashboard"
                  onClick={() => setIsSidebarOpen(false)}
                  className={`block px-3 py-2 rounded-md text-xs sm:text-sm ${location.pathname === "/dashboard" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
                >
                  Dashboard
                </Link>
                <button
                  onClick={() => {
                    setActiveTab("orders");
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs sm:text-sm ${
                    activeTab === "orders" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Orders
                </button>
                <button
                  onClick={() => {
                    setActiveTab("wishlist");
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs sm:text-sm ${
                    activeTab === "wishlist" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Wishlist
                </button>
                <button
                  onClick={() => {
                    setActiveTab("returns");
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs sm:text-sm ${
                    activeTab === "returns" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  My Returns
                </button>
                <Link
                  to="/account/support"
                  onClick={() => setIsSidebarOpen(false)}
                  className={`block px-3 py-2 rounded-md text-xs sm:text-sm ${location.pathname.startsWith("/account/support") ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
                >
                  Support
                </Link>
                <Link
                  to="/account/shipments"
                  onClick={() => setIsSidebarOpen(false)}
                  className={`block px-3 py-2 rounded-md text-xs sm:text-sm ${location.pathname.startsWith("/account/shipments") ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
                >
                  Shipments
                </Link>
                <Link
                  to="/account/profile"
                  onClick={() => setIsSidebarOpen(false)}
                  className={`block px-3 py-2 rounded-md text-xs sm:text-sm ${location.pathname.startsWith("/account/profile") ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
                >
                  Profile
                </Link>
                <button
                  onClick={async () => {
                    try {
                      await signOut();
                      navigate("/");
                      toast({ title: "Signed out" });
                    } catch {
                      navigate("/");
                    }
                    setIsSidebarOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-md text-xs sm:text-sm hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  Logout
                </button>
              </div>
            </div>
          </aside>

          <section className="flex-1 min-w-0 space-y-6 sm:space-y-8">
            {activeTab === "orders" && (
              <section className="mb-8 sm:mb-12">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-xl font-bold">Your Orders</h2>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                      onClick={() => {
                        setLoadingOrders(true);
                        (async () => {
                          try {
                            const res = (await api("/api/orders/mine")) as { ok: boolean; json: OrdersResponse } & any;
                            if (res.ok && res.json?.ok && Array.isArray(res.json.data)) setOrders(res.json.data as Order[]);
                          } catch {}
                          setLoadingOrders(false);
                        })();
                      }}
                    >
                      Refresh
                    </button>
                    <select
                      value={filter}
                      onChange={(e) => {
                        setFilter(e.target.value as any);
                        setShowCount(10);
                      }}
                      className="border border-border rounded px-2 py-1 text-xs sm:text-sm bg-background w-full sm:w-auto"
                    >
                      {statuses.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {loadingOrders ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="animate-pulse border border-border rounded p-4">
                        <div className="h-4 bg-muted/40 rounded w-1/3 mb-2" />
                        <div className="h-3 bg-muted/30 rounded w-1/4" />
                      </div>
                    ))}
                  </div>
                ) : visible.length === 0 ? (
                  <div className="text-center py-12 border border-dashed rounded">
                    <p className="text-muted-foreground mb-4">You have no orders yet.</p>
                    <Link to="/">
                      <Button>Shop Now</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {visible.map((o) => (
                      <Card key={o._id} className={`p-4 ${highlightId === o._id ? "ring-2 ring-primary" : ""}`}>
                        <button className="w-full text-left" onClick={() => toggleExpand(o._id)}>
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold">Order #{(o._id || "").slice(0, 8)}</div>
                              <div className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold">{formatCurrency(Number(o.total || 0))}</div>
                              <div className="mt-1 inline-flex items-center gap-2">
                                {statusBadge(o.status)}
                                <span className="text-xs text-muted-foreground">
                                  {o.items?.reduce((s, i) => s + (i.qty || 0), 0)} item(s)
                                </span>
                              </div>
                            </div>
                          </div>
                          {o.items?.length ? (
                            <div className="flex gap-2 mt-3 overflow-x-auto">
                              {o.items.slice(0, 6).map((it, idx) => (
                                <img key={idx} src={it.image || "/placeholder.svg"} alt={it.title} className="w-10 h-10 object-cover rounded border" />
                              ))}
                            </div>
                          ) : null}
                        </button>

                        {expanded[o._id] && (
                          <div className="mt-4">
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left text-muted-foreground border-b">
                                    <th className="py-2">Item</th>
                                    <th className="py-2">Qty</th>
                                    <th className="py-2">Price</th>
                                    <th className="py-2">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {o.items.map((it, idx) => (
                                    <tr key={idx} className="border-b last:border-b-0">
                                      <td className="py-2">
                                        <div className="flex items-center gap-3">
                                          <img src={it.image || "/placeholder.svg"} alt={it.title} className="w-10 h-10 object-cover rounded border" />
                                          <span className="font-medium">{it.title}</span>
                                        </div>
                                      </td>
                                      <td className="py-2">{it.qty}</td>
                                      <td className="py-2">{formatCurrency(it.price)}</td>
                                      <td className="py-2">{formatCurrency(it.price * it.qty)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
                              <div className="text-sm text-muted-foreground">
                                Payment: {o.paymentMethod || o.payment || "-"}
                                {o.upi?.txnId ? <span className="ml-3 text-xs">UTR: {o.upi.txnId}</span> : null}
                              </div>
                              <div className="flex gap-2">
                                <Link to={`/account/orders/${o._id}/invoice`}>
                                  <Button size="sm" variant="outline">
                                    View Invoice
                                  </Button>
                                </Link>
                                <Button size="sm" onClick={() => reorder(o)}>
                                  Reorder
                                </Button>
                                {(() => {
                                  const deliveredAt = (o as any).deliveredAt || (o.status === 'delivered' ? (o as any).updatedAt : null);
                                  const within7 = deliveredAt ? (Date.now() - new Date(deliveredAt).getTime() <= 7*24*60*60*1000) : false;
                                  return (o.status === 'delivered' && within7) ? (
                                    <Link to={`/my-orders?orderId=${o._id}`}>
                                      <Button size="sm" variant="secondary">Return</Button>
                                    </Link>
                                  ) : null;
                                })()}
                              </div>
                            </div>
                          </div>
                        )}
                      </Card>
                    ))}

                    {filtered.length > showCount && (
                      <div className="text-center pt-2">
                        <Button variant="outline" onClick={() => setShowCount((c) => c + 10)}>
                          Load more
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {activeTab === "cart" && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">Cart</h2>
                  <Link to="/cart" className="text-sm text-primary hover:underline">
                    View Full Cart
                  </Link>
                </div>
                {cartSnapshot.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Your cart is empty. <Link to="/shop" className="text-primary hover:underline">Browse products</Link>
                  </div>
                ) : (
                  <Card className="p-4">
                    <div className="divide-y">
                      {cartSnapshot.map((it) => (
                        <div key={it.id + String(it.image)} className="py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <img src={it.image || "/placeholder.svg"} alt={it.title} className="w-10 h-10 object-cover rounded border" />
                            <div>
                              <div className="font-medium text-sm">{it.title}</div>
                              <div className="text-xs text-muted-foreground">Qty: {it.qty}</div>
                            </div>
                          </div>
                          <div className="text-sm font-medium">{formatCurrency(it.price)}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">Subtotal</div>
                      <div className="font-bold">{formatCurrency(cartSubtotal)}</div>
                    </div>
                    <div className="mt-4 text-right">
                      <Link to="/cart">
                        <Button variant="default">Go to Cart</Button>
                      </Link>
                    </div>
                  </Card>
                )}
              </section>
            )}

            {activeTab === "wishlist" && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">Wishlist</h2>
                  <Link to="/wishlist" className="text-sm text-primary hover:underline">
                    Open Wishlist
                  </Link>
                </div>
                <div className="text-sm text-muted-foreground">Your wishlist items are available in the Wishlist page.</div>
              </section>
            )}

            {activeTab === "returns" && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">My Returns</h2>
                </div>
                <div className="overflow-x-auto bg-[#f9fafb] p-4 rounded-xl shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b">
                        <th className="py-2">Product Name</th>
                        <th className="py-2">Order ID</th>
                        <th className="py-2">Return Date</th>
                        <th className="py-2">Status</th>
                        <th className="py-2">Refund UPI ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.filter((o)=>['Pending','Approved','Rejected'].includes((o as any).returnStatus || 'None')).map((o)=>{
                        const first = (o.items || [])[0];
                        const date = (o as any).returnRequestedAt || (o as any).updatedAt || o.createdAt;
                        return (
                          <tr key={o._id} className="border-b last:border-b-0">
                            <td className="py-2">
                              <div className="flex items-center gap-3">
                                <img src={first?.image || '/placeholder.svg'} alt={first?.title || 'Product'} className="w-10 h-10 object-cover rounded border" />
                                <span className="font-medium truncate max-w-[220px]">{first?.title || '-'}</span>
                              </div>
                            </td>
                            <td className="py-2">{(o._id||'').slice(0,8).toUpperCase()}</td>
                            <td className="py-2">{new Date(date as any).toLocaleDateString()}</td>
                            <td className="py-2">{(o as any).returnStatus}</td>
                            <td className="py-2">{(o as any).refundUpiId || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </section>
        </div>
      </main>
      <Footer />
      <CheckoutModal open={openCheckout} setOpen={setOpenCheckout} />
    </div>
  );
}
