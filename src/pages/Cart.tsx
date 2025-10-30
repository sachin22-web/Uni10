import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { CheckoutModal } from "@/components/CheckoutModal";

const Cart = () => {
  const { items, subtotal, discountAmount, total, appliedCoupon, applyCoupon, removeCoupon, updateQty, removeItem } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [openCheckout, setOpenCheckout] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  useEffect(() => {
    const couponFromUrl = searchParams.get('coupon');
    if (couponFromUrl && !couponCode && !appliedCoupon) {
      setCouponCode(couponFromUrl);
    }
  }, [searchParams, couponCode, appliedCoupon]);

  const handleDecrease = (id: string, qty: number) => {
    if (qty <= 1) return;
    updateQty(id, qty - 1);
  };
  const handleIncrease = (id: string, qty: number) => updateQty(id, qty + 1);
  const handleRemove = (id: string) => {
    removeItem(id);
    toast({ title: "Removed from cart" });
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-3 sm:px-4 pt-24 pb-12">
        <Link to="/shop" className="inline-flex items-center text-xs sm:text-sm text-muted-foreground hover:text-foreground mb-6 sm:mb-8 gap-1">
          <ArrowLeft className="h-4 w-4 flex-shrink-0" />
          Continue Shopping
        </Link>

        <h1 className="text-2xl sm:text-4xl md:text-6xl font-black tracking-tighter mb-8 sm:mb-12">
          Shopping <span className="text-primary">Cart</span>
        </h1>

        {items.length === 0 ? (
          <div className="text-center py-12 sm:py-20">
            <p className="text-base sm:text-xl text-muted-foreground mb-6 sm:mb-8">Your cart is empty</p>
            <Link to="/shop">
              <Button size="lg">Start Shopping</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-3 sm:space-y-4">
              {items.map((item) => (
                <Card key={item.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2 sm:gap-4">
                    {item.image && <img src={item.image} alt={item.title} className="w-16 sm:w-20 h-16 sm:h-20 object-cover rounded flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-xs sm:text-base line-clamp-2">{item.title}</h3>
                      {item.meta?.size && <p className="text-xs sm:text-sm text-muted-foreground">Size: {item.meta.size}</p>}
                      <p className="font-bold mt-1 text-xs sm:text-base">₹{(item.price || 0).toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="flex items-center border border-border rounded text-xs sm:text-base">
                      <button className="px-2 sm:px-3 py-1" onClick={() => handleDecrease(item.id, item.qty)}>-</button>
                      <div className="px-2 sm:px-3 py-1 min-w-[32px] text-center">{item.qty}</div>
                      <button className="px-2 sm:px-3 py-1" onClick={() => handleIncrease(item.id, item.qty)}>+</button>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-xs sm:text-base">₹{(item.qty * item.price).toLocaleString("en-IN")}</div>
                      <button className="text-xs text-destructive mt-1 inline-flex items-center gap-0.5" onClick={() => handleRemove(item.id)}>
                        <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Remove</span>
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Order Summary */}
            <div>
              <Card className="p-4 sm:p-6 sticky top-24">
                <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6">Order Summary</h2>

                <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-semibold">₹{subtotal.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="font-semibold">Free</span>
                  </div>

                  <div className="border-t border-border pt-3 sm:pt-4">
                    <label className="block text-xs font-medium text-muted-foreground mb-2">Have a Coupon?</label>
                    {!appliedCoupon ? (
                      <div className="flex flex-col sm:flex-row gap-2 mb-3">
                        <input
  type="text"
  value={couponCode}
  onChange={(e) => { setCouponCode(e.target.value); setCouponError(null); }}
  placeholder="Enter code"
  className="flex-1 rounded px-2 py-1.5 text-sm
             bg-white dark:bg-slate-900
             text-slate-900 dark:text-slate-100
             placeholder:text-slate-400 dark:placeholder:text-slate-500
             caret-slate-900 dark:caret-slate-100
             border border-slate-300 dark:border-slate-700
             focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:border-slate-500"
  disabled={couponLoading}
/>
                        <Button
                          type="button"
                          onClick={handleApplyCoupon}
                          disabled={couponLoading || !couponCode.trim()}
                          size="sm"
                          variant="outline"
                          className="text-xs h-8 sm:h-9"
                        >
                          Apply
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded p-2 mb-3">
                        <div className="text-xs flex-1">
                          <span className="font-medium text-green-900 dark:text-green-100">{appliedCoupon.code}</span>
                          <span className="text-green-700 dark:text-green-300 ml-2 font-medium">-{appliedCoupon.discount}%</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleRemoveCoupon}
                          className="h-6 px-2 text-xs w-full sm:w-auto"
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                    {couponError && (
                      <p className="text-xs text-destructive mb-2">{couponError}</p>
                    )}
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between text-xs sm:text-sm text-green-700 dark:text-green-300">
                      <span>Discount ({appliedCoupon?.discount}%)</span>
                      <span>-₹{discountAmount.toLocaleString("en-IN")}</span>
                    </div>
                  )}

                  <div className="border-t border-border pt-2 sm:pt-3">
                    <div className="flex justify-between">
                      <span className="font-semibold text-xs sm:text-base">Total</span>
                      <span className="font-bold text-base sm:text-lg">₹{total.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>

                <Button className="w-full text-xs sm:text-sm h-9 sm:h-11" onClick={() => navigate('/checkout')}>
                  Proceed to Checkout
                </Button>
              </Card>
            </div>
          </div>
        )}
      </main>

      <Footer />

      <CheckoutModal open={openCheckout} setOpen={setOpenCheckout} />
    </div>
  );
};

export default Cart;
