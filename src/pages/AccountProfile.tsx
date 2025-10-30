import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AccountProfile() {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [initial, setInitial] = useState<any>(null);
  const [form, setForm] = useState<any>({ name: "", email: "", phone: "", address1: "", address2: "", city: "", state: "", pincode: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const changed = useMemo(() => {
    if (!initial) return {} as any;
    const diff: any = {};
    Object.keys(form).forEach((k) => {
      if (form[k] !== initial[k]) diff[k] = form[k];
    });
    return diff;
  }, [form, initial]);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    load();
  }, [user, loading]);

  const load = async () => {
    setErr("");
    try {
      // Preferred
      let res = await api("/api/user/me");
      if (!(res.ok && res.json?.ok && res.json.user)) {
        // Fallback to auth/me
        res = await api("/api/auth/me");
      }
      if (res.ok && res.json?.user) {
        const u = res.json.user;
        setInitial(u);
        setForm((f: any) => ({ ...f, ...u }));
      } else {
        setErr("Failed to load profile");
      }
    } catch {
      setErr("Failed to load profile");
    }
  };

  const validate = () => {
    if (form.phone && /^\+?\d[\d\s-]{6,15}$/.test(String(form.phone)) === false) return "Invalid phone format";
    if (form.pincode && !(String(form.pincode).length >= 4 && String(form.pincode).length <= 8)) return "Invalid pincode";
    return "";
  };

  const save = async () => {
    const v = validate();
    if (v) {
      setErr(v);
      return;
    }
    if (!Object.keys(changed).length) {
      toast.info("Nothing to update");
      return;
    }
    try {
      setBusy(true);
      setErr("");
      // Preferred: PATCH /api/user/profile
      let res = await api("/api/user/profile", { method: "PATCH", body: JSON.stringify(changed) });
      if (!(res.ok && res.json?.ok)) {
        // Fallback to /api/auth/profile then PUT /api/auth/me
        res = await api("/api/auth/profile", { method: "PATCH", body: JSON.stringify(changed) });
      }
      if (!(res.ok && res.json?.ok)) {
        res = await api("/api/auth/me", { method: "PUT", body: JSON.stringify(changed) });
      }
      if (res.ok && (res.json?.ok || res.json?.user)) {
        toast.success("Profile updated");
        await load();
      } else {
        setErr(res.json?.message || "Failed to update profile");
      }
    } catch {
      setErr("Failed to update profile");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-background" />;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-3 sm:px-4 pt-24 pb-12">
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
                <Link to="/dashboard" onClick={() => setIsSidebarOpen(false)} className={`block px-3 py-2 rounded-md text-xs sm:text-sm ${location.pathname === "/dashboard" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}>Dashboard</Link>
                <Link to="/dashboard?tab=orders" onClick={() => setIsSidebarOpen(false)} className={`block px-3 py-2 rounded-md text-xs sm:text-sm ${location.pathname.startsWith("/dashboard") ? "" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}>Orders</Link>
                <Link to="/dashboard?tab=wishlist" onClick={() => setIsSidebarOpen(false)} className={`block px-3 py-2 rounded-md text-xs sm:text-sm ${location.pathname.startsWith("/dashboard") ? "" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}>Wishlist</Link>
                <Link to="/account/support" onClick={() => setIsSidebarOpen(false)} className={`block px-3 py-2 rounded-md text-xs sm:text-sm ${location.pathname.startsWith("/account/support") ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}>Support</Link>
                <Link to="/account/shipments" onClick={() => setIsSidebarOpen(false)} className={`block px-3 py-2 rounded-md text-xs sm:text-sm ${location.pathname.startsWith("/account/shipments") ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}>Shipments</Link>
                <Link to="/account/profile" onClick={() => setIsSidebarOpen(false)} className={`block px-3 py-2 rounded-md text-xs sm:text-sm ${location.pathname.startsWith("/account/profile") ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}>Profile</Link>
                <button
                  onClick={async () => { try { await signOut(); navigate("/"); toast.success("Signed out"); } catch { navigate("/"); } setIsSidebarOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-md text-xs sm:text-sm hover:bg-muted text-muted-foreground hover:text-foreground"
                >Logout</button>
              </div>
            </div>
          </aside>

          <section className="flex-1 min-w-0">
            <div className="mb-4 sm:mb-6">
              <h1 className="text-xl sm:text-2xl font-bold">Profile</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">View and edit your account details</p>
            </div>

            {!initial ? (
              <div className="space-y-3 max-w-2xl">
                <Skeleton className="h-28" />
                <Skeleton className="h-56" />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:gap-6 max-w-4xl">
                <Card>
                  <CardHeader className="pb-3 sm:pb-6">
                    <CardTitle className="text-lg sm:text-xl">Account</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Update your personal information</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <Label htmlFor="name">Name</Label>
                        <Input id="name" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                      </div>
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" value={form.email || ""} readOnly />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone</Label>
                        <Input id="phone" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                      </div>
                      <div>
                        <Label htmlFor="address1">Address 1</Label>
                        <Input id="address1" value={form.address1 || ""} onChange={(e) => setForm({ ...form, address1: e.target.value })} />
                      </div>
                      <div>
                        <Label htmlFor="address2">Address 2</Label>
                        <Input id="address2" value={form.address2 || ""} onChange={(e) => setForm({ ...form, address2: e.target.value })} />
                      </div>
                      <div>
                        <Label htmlFor="city">City</Label>
                        <Input id="city" value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                      </div>
                      <div>
                        <Label htmlFor="state">State</Label>
                        <Input id="state" value={form.state || ""} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                      </div>
                      <div>
                        <Label htmlFor="pincode">Pincode</Label>
                        <Input id="pincode" value={form.pincode || ""} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
                      </div>
                    </div>
                    {err ? <div className="text-xs text-red-600 mt-3">{err}</div> : null}
                    <div className="mt-4 flex gap-2">
                      <Button onClick={save} disabled={busy}>Save Changes</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
