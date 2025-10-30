import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";

// Shipment types
export type ShipmentCheckpoint = { time: string; status: string; location?: string; note?: string };
export type ShipmentItem = { image?: string; title?: string };
export type Shipment = {
  orderId: string;
  orderDate?: string;
  trackingId: string;
  courier?: string;
  status: string;
  eta?: string;
  items?: ShipmentItem[];
  checkpoints?: ShipmentCheckpoint[];
};

function statusBadge(status: string) {
  const s = (status || "").toLowerCase();
  const map: Record<string, string> = {
    created: "bg-gray-100 text-gray-800 border border-gray-200",
    packed: "bg-amber-100 text-amber-800 border border-amber-200",
    shipped: "bg-blue-100 text-blue-800 border border-blue-200",
    out_for_delivery: "bg-indigo-100 text-indigo-800 border border-indigo-200",
    delivered: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    cancelled: "bg-red-100 text-red-800 border border-red-200",
    return_initiated: "bg-pink-100 text-pink-800 border border-pink-200",
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${map[s] || "bg-muted text-foreground/80"}`}>{status}</span>;
}

function mapOrdersToShipments(orders: any[]): Shipment[] {
  return (orders || []).map((o) => {
    const first = (o.items || [])[0] || {};
    const status = (o.status || "").toLowerCase();
    const nowIso = new Date().toISOString();
    const cps: ShipmentCheckpoint[] = [
      { time: o.createdAt || nowIso, status: "created", location: "Warehouse" },
    ];
    if (["paid", "verified", "processing"].includes(status)) cps.push({ time: o.createdAt || nowIso, status: "packed" });
    if (["shipped", "out_for_delivery", "delivered"].includes(status)) cps.push({ time: o.createdAt || nowIso, status: "shipped" });
    if (["out_for_delivery", "delivered"].includes(status)) cps.push({ time: o.createdAt || nowIso, status: "out_for_delivery" });
    if (status === "delivered") cps.push({ time: nowIso, status: "delivered" });
    if (status === "cancelled") cps.push({ time: nowIso, status: "cancelled" });

    return {
      orderId: o._id,
      orderDate: o.createdAt,
      trackingId: (o.trackingId as string) || String(o._id).slice(-10),
      courier: (o.courier as string) || "—",
      status: status === "paid" ? "packed" : status,
      eta: o.eta || undefined,
      items: [{ image: first.image, title: first.title }],
      checkpoints: cps,
    } as Shipment;
  });
}

export default function AccountShipments() {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState<string>("");
  const [filter, setFilter] = useState<"All" | "In Transit" | "Delivered" | "Cancelled">("All");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Shipment | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    fetchShipments();
  }, [user, loading]);

  const fetchShipments = async () => {
    try {
      setLoadingList(true);
      setError("");
      // Preferred endpoint
      const res = await api(`/api/shipments/mine?v=${Date.now()}`, { cache: "no-store" as any });
      if (res.ok && Array.isArray(res.json?.data)) {
        setShipments((res.json.data as any[]).map((s: any) => ({
          orderId: s.orderId,
          orderDate: s.orderDate,
          trackingId: s.trackingId,
          courier: s.courier,
          status: s.status,
          eta: s.eta,
          items: s.items || [],
          checkpoints: s.checkpoints || [],
        })));
      } else {
        // Fallback: orders -> shipments
        const o = await api(`/api/orders/mine?v=${Date.now()}`, { cache: "no-store" as any });
        if (o.ok && Array.isArray(o.json?.data)) setShipments(mapOrdersToShipments(o.json.data as any[]));
        else setShipments([]);
      }
    } catch (e) {
      setError("Failed to load shipments");
    } finally {
      setLoadingList(false);
    }
  };

  const filtered = useMemo(() => {
    let list = shipments;
    if (filter !== "All") {
      if (filter === "In Transit") list = list.filter((s) => ["shipped", "out_for_delivery", "packed"].includes((s.status || "").toLowerCase()));
      if (filter === "Delivered") list = list.filter((s) => (s.status || "").toLowerCase() === "delivered");
      if (filter === "Cancelled") list = list.filter((s) => (s.status || "").toLowerCase() === "cancelled");
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((s) => s.orderId.toLowerCase().includes(q) || (s.trackingId || "").toLowerCase().includes(q));
    }
    return list;
  }, [shipments, filter, query]);

  const openDetail = async (s: Shipment) => {
    try {
      // Try to refresh via single endpoint
      const res = await api(`/api/shipments/${encodeURIComponent(s.trackingId)}`);
      if (res.ok && res.json?.data) {
        const d = res.json.data as any;
        setActive({
          ...s,
            courier: d.courier || s.courier,
            status: d.status || s.status,
            eta: d.eta || s.eta,
            checkpoints: Array.isArray(d.checkpoints) ? d.checkpoints : s.checkpoints,
        });
      } else {
        setActive(s);
      }
      setOpen(true);
    } catch {
      setActive(s);
      setOpen(true);
    }
  };

  if (loading) return <div className="min-h-screen bg-background" />;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-56 w-full">
            <div className="bg-card border border-border rounded-lg p-3 sticky top-24">
              <div className="text-sm font-semibold text-muted-foreground mb-2">Dashboard</div>
              <div className="space-y-1">
                <Link to="/dashboard" className={`block px-3 py-2 rounded-md text-sm ${location.pathname === "/dashboard" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}>Dashboard</Link>
                <Link to="/dashboard?tab=orders" className={`block px-3 py-2 rounded-md text-sm ${location.pathname.startsWith("/dashboard") ? "" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}>Orders</Link>
                <Link to="/dashboard?tab=wishlist" className={`block px-3 py-2 rounded-md text-sm ${location.pathname.startsWith("/dashboard") ? "" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}>Wishlist</Link>
                <Link to="/account/support" className={`block px-3 py-2 rounded-md text-sm ${location.pathname.startsWith("/account/support") ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}>Support</Link>
                <Link to="/account/shipments" className={`block px-3 py-2 rounded-md text-sm ${location.pathname.startsWith("/account/shipments") ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}>Shipments</Link>
                <Link to="/account/profile" className={`block px-3 py-2 rounded-md text-sm ${location.pathname.startsWith("/account/profile") ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}>Profile</Link>
                <button
                  onClick={async () => { try { await signOut(); navigate("/"); toast.success("Signed out"); } catch { navigate("/"); } }}
                  className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted text-muted-foreground hover:text-foreground"
                >Logout</button>
              </div>
            </div>
          </aside>

          <section className="flex-1 min-w-0">
            <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">Shipments</h1>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={fetchShipments}>Refresh</Button>
                <Input placeholder="Search by order or tracking id" value={query} onChange={(e) => setQuery(e.target.value)} className="w-64" />
              </div>
            </div>
            <div className="flex items-center gap-2 mb-4 text-sm">
              {(["All", "In Transit", "Delivered", "Cancelled"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-md border ${filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted text-muted-foreground hover:text-foreground"}`}
                >
                  {f}
                </button>
              ))}
            </div>

            {loadingList ? (
              <div className="space-y-3">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
            ) : error ? (
              <Card className="p-4 text-sm text-red-600">{error}</Card>
            ) : filtered.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">No shipments yet.</Card>
            ) : (
              <div className="space-y-3">
                {filtered.map((s) => {
                  const first = s.items?.[0];
                  const more = (s.items?.length || 0) > 1 ? ` (+${(s.items!.length - 1)})` : "";
                  return (
                    <Card key={`${s.orderId}-${s.trackingId}`} className="p-4 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => openDetail(s)}>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <img src={first?.image || "/placeholder.svg"} alt={first?.title || "Item"} className="w-12 h-12 object-cover rounded border" />
                          <div className="min-w-0">
                            <div className="font-semibold truncate">Order #{s.orderId.slice(0, 8)}</div>
                            <div className="text-xs text-muted-foreground truncate">{first?.title || "Items"}{more}</div>
                          </div>
                        </div>
                        <div className="text-right min-w-[220px]">
                          <div className="text-sm">Tracking: <span className="font-mono">{s.trackingId}</span></div>
                          <div className="text-xs text-muted-foreground">{s.courier || "—"}</div>
                        </div>
                        <div className="min-w-[140px] text-right">
                          <div className="inline-block">{statusBadge(s.status)}</div>
                          <div className="text-xs text-muted-foreground mt-1">ETA: {s.eta ? new Date(s.eta).toLocaleDateString() : "—"}</div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[80vh] overflow-y-auto">
          <DrawerHeader className="sticky top-0 bg-background border-b">
            <div className="flex items-start justify-between">
              <div>
                <DrawerTitle>Tracking Detail</DrawerTitle>
                <p className="text-sm text-muted-foreground mt-1">{active ? `Order #${active.orderId.slice(0,8)} • ${active.trackingId}` : ""}</p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchShipments}>Refresh</Button>
            </div>
          </DrawerHeader>
          <div className="p-4">
            {!active ? (
              <Skeleton className="h-24" />
            ) : (
              <div className="grid gap-4">
                <div className="text-sm">Status: {statusBadge(active.status)}</div>
                <div className="text-sm text-muted-foreground">ETA: {active.eta ? new Date(active.eta).toLocaleString() : "—"}</div>
                <div className="mt-2">
                  <div className="font-semibold mb-2">Timeline</div>
                  <div className="relative pl-4 border-l">
                    {(active.checkpoints || []).map((c, idx) => (
                      <div key={idx} className="mb-4">
                        <div className="text-xs text-muted-foreground">{c.time ? new Date(c.time).toLocaleString() : ""}</div>
                        <div className="font-medium">{c.status}</div>
                        {c.location ? <div className="text-xs text-muted-foreground">{c.location}</div> : null}
                        {c.note ? <div className="text-xs text-muted-foreground">{c.note}</div> : null}
                      </div>
                    ))}
                    {(!active.checkpoints || active.checkpoints.length === 0) && (
                      <div className="text-sm text-muted-foreground">No checkpoints available.</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <Footer />
    </div>
  );
}
