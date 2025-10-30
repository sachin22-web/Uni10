import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Loader2, Copy, Check } from "lucide-react";

type Props = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

type PaymentSettings = {
  upiQrImage: string;
  upiId: string;
  beneficiaryName: string;
  instructions: string;
};

export const CheckoutModal: React.FC<Props> = ({ open, setOpen }) => {
  const { items, subtotal, discountAmount, total, appliedCoupon, applyCoupon, removeCoupon, placeOrder, clearCart } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [pincode, setPincode] = useState("");
  const [payment, setPayment] = useState<"COD" | "UPI">("COD");
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);

  const [upiPayerName, setUpiPayerName] = useState("");
  const [upiTxnId, setUpiTxnId] = useState("");
  const [copiedUpiId, setCopiedUpiId] = useState(false);

  const fetchPaymentSettings = async () => {
    try {
      setLoadingSettings(true);
      setSettingsError(null);
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch("/api/settings/payments", {
        method: "GET",
        headers,
        credentials: "include",
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {}

      if (response.ok && data?.data) {
        const p = data.data as any;
        setPaymentSettings({
          upiQrImage:
            typeof p.upiQrImage === "string" && p.updatedAt
              ? `${p.upiQrImage}?v=${encodeURIComponent(p.updatedAt)}`
              : p.upiQrImage || "",
          upiId: p.upiId || "",
          beneficiaryName: p.beneficiaryName || "",
          instructions: p.instructions || "",
        });
      } else {
        setSettingsError("Failed to load UPI settings");
      }
    } catch (error) {
      console.error("Failed to fetch payment settings:", error);
      setSettingsError("Failed to load UPI settings");
    } finally {
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    if (open && payment === "UPI") {
      fetchPaymentSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, payment]);

  const handleCopyUpiId = () => {
    if (paymentSettings?.upiId) {
      navigator.clipboard.writeText(paymentSettings.upiId);
      setCopiedUpiId(true);
      setTimeout(() => setCopiedUpiId(false), 2000);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError("Enter a coupon code");
      return;
    }

    setCouponLoading(true);
    setCouponError(null);

    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch("/api/coupons/validate", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ code: couponCode }),
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        applyCoupon({ code: data.data.code, discount: data.data.discount });
        setCouponCode("");
        toast({ title: `Coupon applied! ${data.data.discount}% off` });
      } else {
        setCouponError(data.message || "Invalid coupon");
      }
    } catch (error) {
      setCouponError("Failed to validate coupon");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    removeCoupon();
    setCouponCode("");
    setCouponError(null);
    toast({ title: "Coupon removed" });
  };

  const fieldBase =
    "w-full border border-border rounded px-3 py-2 " +
    "text-foreground placeholder:text-muted-foreground bg-background " +
    "focus:outline-none focus:ring-2 focus:ring-ring " +
    "disabled:opacity-50 disabled:cursor-not-allowed";

  const handlePlaceOrder = async () => {
    if (!name || !phone || !address) {
      toast({ title: "Please fill name, phone and address", variant: "destructive" });
      return;
    }
    if (!city || !stateName || !pincode) {
      toast({ title: "Please add city, state and pincode", variant: "destructive" });
      return;
    }
    if (!/^\d{6}$/.test(pincode)) {
      toast({ title: "Enter a valid 6-digit pincode", variant: "destructive" });
      return;
    }
    if (payment === "UPI" && !upiPayerName) {
      toast({ title: "Please enter payer name for UPI payment", variant: "destructive" });
      return;
    }

    setLoading(true);

    const payload: any = {
      name,
      phone,
      address,
      city,
      state: stateName,
      pincode,
      paymentMethod: payment,
      items: items.map((i) => ({
        id: i.id,
        productId: i.id,
        title: i.title,
        price: i.price,
        qty: i.qty,
        meta: i.meta,
        image: i.image,
        size: i.meta?.size || undefined,
      })),
      subtotal,
      discountAmount,
      total,
      coupon: appliedCoupon ? { code: appliedCoupon.code, discount: appliedCoupon.discount } : undefined,
      status: "pending",
      upi: payment === "UPI" ? { payerName: upiPayerName, txnId: upiTxnId || undefined } : undefined,
      customer: { name, phone, address, city, state: stateName, pincode },
    };

    // Apply coupon if present
    if (appliedCoupon) {
      try {
        const token = localStorage.getItem("token");
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        await fetch("/api/coupons/apply", {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ code: appliedCoupon.code }),
        });
      } catch (err) {
        console.warn("Failed to mark coupon as used:", err);
      }
    }

    const res = await placeOrder(payload);
    setLoading(false);

    if (res.ok) {
      const newOrderId = String((res.data?._id || res.data?.id) ?? "local_" + Date.now());

      try {
        const raw = localStorage.getItem("uni_orders_v1");
        const arr = raw ? (JSON.parse(raw) as any[]) : [];
        const order = {
          _id: newOrderId,
          name,
          phone,
          address,
          city,
          state: stateName,
          pincode,
          total,
          paymentMethod: payment,
          status: "pending",
          createdAt: new Date().toISOString(),
          items: items.map((i) => ({ id: i.id, title: i.title, price: i.price, qty: i.qty, image: i.image, size: i.meta?.size })),
          upi: payment === "UPI" ? { payerName: upiPayerName, txnId: upiTxnId || undefined } : undefined,
        } as any;
        localStorage.setItem("uni_orders_v1", JSON.stringify([order, ...arr]));
        localStorage.setItem("uni_last_order_id", newOrderId);
      } catch (e) {
        console.error("Failed to persist local order", e);
      }

      toast({
        title: "Order placed",
        description:
          payment === "COD"
            ? `Order #${newOrderId}: Order placed successfully. Awaiting delivery confirmation.`
            : `Order #${newOrderId}: Payment pending verification. We'll confirm your order shortly.`,
      });
      try {
        window.dispatchEvent(new CustomEvent("order:placed", { detail: { id: newOrderId } }));
      } catch {}
      clearCart();
      setOpen(false);
      navigate("/dashboard", { replace: true });
    } else {
      const errorMsg = res.error?.message || String(res.error ?? "Unknown error");
      toast({
        title: "Order failed",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Checkout</DialogTitle>
          <DialogDescription>Complete your purchase</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="name">Name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} className={fieldBase} autoComplete="name" placeholder="Your full name" type="text" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="phone">Phone</label>
            <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldBase} autoComplete="tel" inputMode="numeric" placeholder="9876543210" type="tel" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="address">Address</label>
            <textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} className={fieldBase + " min-h-[96px]"} rows={3} autoComplete="street-address" placeholder="House no., Street, Area" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="city">City</label>
              <input id="city" value={city} onChange={(e) => setCity(e.target.value)} className={fieldBase} autoComplete="address-level2" placeholder="City" type="text" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="state">State</label>
              <input id="state" value={stateName} onChange={(e) => setStateName(e.target.value)} className={fieldBase} autoComplete="address-level1" placeholder="State" type="text" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="pincode">Pincode</label>
              <input id="pincode" value={pincode} onChange={(e) => setPincode(e.target.value.replace(/[^\d]/g, ''))} className={fieldBase} autoComplete="postal-code" placeholder="110001" inputMode="numeric" maxLength={6} />
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <label className="block text-sm font-medium mb-2">Have a Coupon?</label>
            {!appliedCoupon ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => { setCouponCode(e.target.value); setCouponError(null); }}
                  placeholder="Enter coupon code"
                  className={fieldBase}
                  disabled={couponLoading}
                />
                <Button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={couponLoading || !couponCode.trim()}
                  size="sm"
                >
                  {couponLoading ? "Applying..." : "Apply"}
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded p-3">
                <div className="text-sm">
                  <span className="font-medium">{appliedCoupon.code}</span>
                  <span className="text-green-700 dark:text-green-300 ml-2">-{appliedCoupon.discount}%</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveCoupon}
                >
                  Remove
                </Button>
              </div>
            )}
            {couponError && (
              <p className="text-xs text-destructive mt-1">{couponError}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Payment Method</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input className="accent-primary" type="radio" name="payment" checked={payment === "COD"} onChange={() => { setPayment("COD"); setSettingsError(null); }} />
                <span className="text-sm">Cash on Delivery</span>
              </label>
              <label className="flex items-center gap-2">
                <input className="accent-primary" type="radio" name="payment" checked={payment === "UPI"} onChange={() => { setPayment("UPI"); }} />
                <span className="text-sm">UPI</span>
              </label>
            </div>
          </div>

          {payment === "UPI" && (
            <div className="border border-border rounded-lg p-4 bg-muted space-y-4">
              {loadingSettings ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading UPI details...
                </div>
              ) : settingsError ? (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded">{settingsError}</div>
              ) : paymentSettings ? (
                <>
                  {paymentSettings.upiQrImage && (
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-sm font-medium">Scan QR Code to Pay</p>
                      <img
                        src={(function(){
                          const s = String(paymentSettings.upiQrImage || '');
                          if (!s) return '';
                          if (s.startsWith('http')) {
                            try { const u = new URL(s); if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return `/api${u.pathname}`; } catch {}
                            return s;
                          }
                          if (s.startsWith('/api/uploads')) return s;
                          if (s.startsWith('/uploads')) return `/api${s}`;
                          if (s.startsWith('uploads')) return `/api/${s}`;
                          return s;
                        })()}
                        alt="UPI QR Code"
                        className="w-40 h-40 border border-border rounded p-1 bg-white"
                        onError={() => setQrError(true)}
                      />
                      {qrError && (<div className="text-[11px] text-destructive">QR not available</div>)}
                    </div>
                  )}

                  {paymentSettings.upiId && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">UPI ID: {paymentSettings.upiId}</div>
                      <Button type="button" variant="outline" size="sm" onClick={handleCopyUpiId} className="w-full">
                        {copiedUpiId ? (<><Check className="h-4 w-4 mr-2" />Copied!</>) : (<><Copy className="h-4 w-4 mr-2" />Copy UPI ID</>)}
                      </Button>
                    </div>
                  )}

                  {paymentSettings.beneficiaryName && (
                    <div className="text-xs text-muted-foreground">Beneficiary: {paymentSettings.beneficiaryName}</div>
                  )}

                  {paymentSettings.instructions && (
                    <p className="text-xs text-muted-foreground italic">{paymentSettings.instructions}</p>
                  )}

                  <div className="border-t border-border pt-4 space-y-3">
                    <p className="text-sm font-medium">Confirm Payment</p>
                    <div>
                      <label className="block text-xs font-medium mb-1">Payer Name *</label>
                      <input type="text" value={upiPayerName} onChange={(e) => setUpiPayerName(e.target.value)} className={fieldBase} placeholder="Your name" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">UTR / Txn ID (optional)</label>
                      <input type="text" value={upiTxnId} onChange={(e) => setUpiTxnId(e.target.value)} className={fieldBase} placeholder="Enter transaction ID if available" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Amount</label>
                      <div className="text-sm font-semibold">₹{total.toLocaleString("en-IN")}</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
                  UPI settings not configured yet
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="w-full flex flex-col gap-4">
            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>₹{subtotal.toLocaleString("en-IN")}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-700 dark:text-green-300">
                  <span>Discount ({appliedCoupon?.discount}%)</span>
                  <span>-₹{discountAmount.toLocaleString("en-IN")}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>₹{total.toLocaleString("en-IN")}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
              <Button onClick={handlePlaceOrder} disabled={loading} className="flex-1">
                {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Placing…</>) : payment === "UPI" ? ("I Have Paid") : ("Place Order")}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
