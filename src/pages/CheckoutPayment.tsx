import { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Copy, Check } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';

type PaymentSettings = {
  upiQrImage: string;
  upiId: string;
  beneficiaryName: string;
  instructions: string;
};

type RazorpaySettings = {
  keyId: string;
  currency: string;
  isActive: boolean;
};

/**
 * Safe response parser that reads the body once and handles JSON parsing errors
 * Prevents "body stream already read" errors by reading as text first
 */
async function safeParseResponse<T = any>(response: Response): Promise<T> {
  const bodyText = await response.text();

  if (!bodyText) {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return {} as T;
  }

  try {
    return JSON.parse(bodyText) as T;
  } catch {
    if (!response.ok) {
      throw new Error(bodyText || `HTTP ${response.status} ${response.statusText}`);
    }
    throw new Error('Invalid JSON response from server');
  }
}

const CheckoutPayment = () => {
  const { items, subtotal, discountAmount, total, appliedCoupon, clearCart } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'upi'>('razorpay');
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [razorpaySettings, setRazorpaySettings] = useState<RazorpaySettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [upiTransactionId, setUpiTransactionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedUpiId, setCopiedUpiId] = useState(false);

  // Customer details
  const [customerDetails, setCustomerDetails] = useState({
    name: localStorage.getItem('userName') || '',
    phone: localStorage.getItem('userPhone') || '',
    address: localStorage.getItem('userAddress') || '',
    city: localStorage.getItem('userCity') || '',
    state: localStorage.getItem('userState') || '',
    pincode: localStorage.getItem('userPincode') || '',
  });

  const buildUpiUri = (scheme?: string) => {
    const pa = encodeURIComponent(paymentSettings?.upiId || '');
    if (!pa) return '';
    const pn = encodeURIComponent(paymentSettings?.beneficiaryName || '');
    const am = encodeURIComponent((total || 0).toFixed(2));
    const tn = encodeURIComponent('Order payment at UNI10');
    const base = scheme ? scheme : 'upi://pay';
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}pa=${pa}&pn=${pn}&am=${am}&cu=INR&tn=${tn}`;
  };

  const openUpiApp = (scheme?: string) => {
    const uri = buildUpiUri(scheme);
    if (!uri) {
      toast({ title: 'UPI not configured', description: 'UPI ID is missing', variant: 'destructive' });
      return;
    }
    const startVisible = document.visibilityState;
    try {
      window.location.href = uri;
    } catch (_) {}
    if (scheme) {
      setTimeout(() => {
        if (document.visibilityState === startVisible) {
          const fallback = buildUpiUri('upi://pay');
          try { window.location.href = fallback; } catch (_) {}
        }
      }, 1200);
    }
  };

  useEffect(() => {
    fetchPaymentSettings();
    fetchRazorpaySettings();
  }, []);

  const fetchPaymentSettings = async () => {
    try {
      setLoadingSettings(true);
      const { ok, json } = await api('/api/settings/payments');
      if (ok && json?.data) {
        const p = json.data as any;
        setPaymentSettings({
          upiQrImage:
            typeof p.upiQrImage === 'string' && p.updatedAt
              ? `${p.upiQrImage}?v=${encodeURIComponent(p.updatedAt)}`
              : p.upiQrImage || '',
          upiId: p.upiId || '',
          beneficiaryName: p.beneficiaryName || '',
          instructions: p.instructions || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch payment settings:', error);
    } finally {
      setLoadingSettings(false);
    }
  };

  const fetchRazorpaySettings = async () => {
    try {
      const { ok, json } = await api('/api/settings/razorpay/public');
      if (ok && json?.data) {
        const r = json.data as any;
        setRazorpaySettings({
          keyId: r.keyId || '',
          currency: r.currency || 'INR',
          isActive: r.isActive || false,
        });
      }
    } catch (error) {
      console.error('Failed to fetch Razorpay settings:', error);
    }
  };

  const handleRazorpayPayment = async () => {
    try {
      // Validate customer details first
      if (!customerDetails.name || !customerDetails.phone || !customerDetails.address || !customerDetails.city || !customerDetails.state || !customerDetails.pincode) {
        toast({
          title: 'Missing Details',
          description: 'Please fill in all delivery details before proceeding to payment',
          variant: 'destructive',
        });
        return;
      }

      setSubmitting(true);

      // Ensure Razorpay SDK is loaded
      if (!(window as any).Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
          if (existing) return existing.addEventListener('load', () => resolve());
          const s = document.createElement('script');
          s.src = 'https://checkout.razorpay.com/v1/checkout.js';
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
          document.body.appendChild(s);
        });
      }

      // Create order on backend
      const response = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          amount: total,
          currency: 'INR',
          items,
          appliedCoupon,
        }),
      });

      const data = await safeParseResponse<any>(response);

      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'Failed to create order');
      }

      const { orderId, keyId, amount, currency } = data.data || {};

      // Validate response data and alert on failure
      if (!orderId || typeof orderId !== 'string' || !orderId.trim() || !keyId || typeof keyId !== 'string' || !keyId.trim() || !amount || Number(amount) <= 0) {
        alert('Invalid order details. Please refresh and try again.');
        setSubmitting(false);
        return;
      }

      // Show success toast (green)
      toast({
        title: 'Payment initiated successfully',
        description: 'Opening secure payment gateway...',
      });

      const options = {
        key: keyId.trim(),
        amount: amount,
        currency: currency || 'INR',
        name: 'UNI10',
        description: `Order for ₹${total}`,
        order_id: orderId.trim(),
        handler: async (response: any) => {
          try {
            const authToken = localStorage.getItem('token') || '';
            const verifyRes = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
              },
              body: JSON.stringify({
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature,
                items,
                appliedCoupon,
                total,
                name: customerDetails.name,
                phone: customerDetails.phone,
                address: customerDetails.address,
                city: customerDetails.city,
                state: customerDetails.state,
                pincode: customerDetails.pincode,
              }),
            });

            const vjson = await safeParseResponse<any>(verifyRes);

            if (!verifyRes.ok || !vjson.ok) {
              throw new Error(vjson.message || 'Verification failed');
            }

            toast({
              title: 'Payment successful ✓',
              description: 'Your order has been confirmed',
            });
            clearCart();
            navigate('/orders/success');
          } catch (error: any) {
            toast({
              title: 'Payment Verification Failed',
              description: error?.message || 'Failed to verify payment',
              variant: 'destructive',
            });
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: () => {
            console.warn('Payment cancelled by user.');
            setSubmitting(false);
          },
        },
        prefill: {
          name: customerDetails.name,
          email: localStorage.getItem('userEmail') || '',
          contact: customerDetails.phone,
        },
        theme: {
          color: '#EF4444',
        },
      };

      const razorpayWindow = (window as any).Razorpay;
      if (!razorpayWindow) {
        throw new Error('Razorpay SDK not loaded');
      }

      const rzp = new razorpayWindow(options);
      rzp.on('payment.failed', (error: any) => {
        toast({
          title: 'Payment Failed',
          description: error?.error?.description || 'Payment could not be processed',
          variant: 'destructive',
        });
        setSubmitting(false);
      });
      rzp.open();
    } catch (error: any) {
      // Show red toast if server unreachable or other errors
      toast({
        title: 'Server not reachable. Try again later.',
        description: error?.message || 'Failed to initiate payment',
        variant: 'destructive',
      });
      setSubmitting(false);
    }
  };

  const handleUpiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!upiTransactionId.trim()) {
      toast({
        title: 'Transaction ID Required',
        description: 'Please enter your UPI transaction ID',
        variant: 'destructive',
      });
      return;
    }

    // Validate customer details
    if (!customerDetails.name || !customerDetails.phone || !customerDetails.address || !customerDetails.city || !customerDetails.state || !customerDetails.pincode) {
      toast({
        title: 'Missing Details',
        description: 'Please fill in all delivery details',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch('/api/payment/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          transactionId: upiTransactionId.trim(),
          amount: total,
          paymentMethod: 'UPI',
          items: items.map(i => ({ id: i.id, title: i.title, price: i.price, qty: i.qty, image: i.image, size: i.meta?.size, productId: i.id })),
          appliedCoupon,
          name: customerDetails.name,
          phone: customerDetails.phone,
          address: customerDetails.address,
          city: customerDetails.city,
          state: customerDetails.state,
          pincode: customerDetails.pincode,
        }),
      });

      const data = await safeParseResponse<any>(response);

      if (response.ok && data.ok) {
        toast({
          title: 'Payment Submitted!',
          description: 'Your payment proof has been submitted. We will verify it shortly.',
        });
        setUpiTransactionId('');
        clearCart();
        navigate('/dashboard');
      } else {
        throw new Error(data.message || 'Failed to submit payment');
      }
    } catch (error: any) {
      toast({
        title: 'Submission Error',
        description: error?.message || 'Failed to submit payment proof',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const copyUpiId = async () => {
    if (paymentSettings?.upiId) {
      try {
        await navigator.clipboard.writeText(paymentSettings.upiId);
        setCopiedUpiId(true);
        setTimeout(() => setCopiedUpiId(false), 2000);
        toast({
          title: 'Copied!',
          description: 'UPI ID copied to clipboard',
        });
      } catch (error) {
        toast({
          title: 'Copy Failed',
          description: 'Could not copy UPI ID',
          variant: 'destructive',
        });
      }
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 pt-24 pb-12">
          <div className="text-center py-20">
            <h1 className="text-2xl font-bold mb-4">Your cart is empty</h1>
            <p className="text-muted-foreground mb-8">Please add items to your cart before proceeding to checkout.</p>
            <Link to="/shop">
              <Button size="lg">Continue Shopping</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <Link to="/cart" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Cart
        </Link>

        <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-12">
          Complete Your <span className="text-primary">Payment</span>
        </h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Delivery & Payment Options */}
          <div className="lg:col-span-2 space-y-6">
            {/* Delivery Details */}
            <Card className="p-4 rounded-xl text-sm shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold mb-4">Delivery Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your full name"
                    value={customerDetails.name}
                    onChange={(e) => setCustomerDetails({ ...customerDetails, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="10-digit mobile number"
                    value={customerDetails.phone}
                    onChange={(e) => setCustomerDetails({ ...customerDetails, phone: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="address">Street Address *</Label>
                  <Input
                    id="address"
                    type="text"
                    placeholder="House number, street name"
                    value={customerDetails.address}
                    onChange={(e) => setCustomerDetails({ ...customerDetails, address: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    type="text"
                    placeholder="City"
                    value={customerDetails.city}
                    onChange={(e) => setCustomerDetails({ ...customerDetails, city: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="state">State *</Label>
                  <Input
                    id="state"
                    type="text"
                    placeholder="State"
                    value={customerDetails.state}
                    onChange={(e) => setCustomerDetails({ ...customerDetails, state: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="pincode">Pincode *</Label>
                  <Input
                    id="pincode"
                    type="text"
                    placeholder="6-8 digit pincode"
                    value={customerDetails.pincode}
                    onChange={(e) => setCustomerDetails({ ...customerDetails, pincode: e.target.value })}
                  />
                </div>
              </div>
            </Card>

            {/* Payment Options */}
            {/* Razorpay Option */}
            <Card className={`p-4 rounded-xl text-sm shadow-sm border ${razorpaySettings?.isActive ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
              <div className="flex items-center gap-4 mb-6">
                <div
                  className={`w-5 h-5 rounded-full border-2 ${razorpaySettings?.isActive ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                  onClick={() => razorpaySettings?.isActive && setPaymentMethod('razorpay')}
                  style={{
                    borderColor: paymentMethod === 'razorpay' && razorpaySettings?.isActive ? '#3b82f6' : '#d1d5db',
                    backgroundColor: paymentMethod === 'razorpay' && razorpaySettings?.isActive ? '#3b82f6' : 'transparent',
                  }}
                />
                <div>
                  <h3 className="font-semibold text-lg">Pay with Razorpay</h3>
                  <p className="text-sm text-muted-foreground">Quick and secure payment</p>
                  {!razorpaySettings?.isActive && (
                    <p className="text-xs text-destructive mt-1">Currently unavailable</p>
                  )}
                </div>
              </div>

              {paymentMethod === 'razorpay' && razorpaySettings?.isActive && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Click the button below to complete your payment securely using Razorpay.
                  </p>
                  <Button
                    size="lg"
                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                    onClick={handleRazorpayPayment}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Pay with Razorpay'
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Test Mode: Uses Razorpay test keys
                  </p>
                </div>
              )}
              {!razorpaySettings?.isActive && (
                <p className="text-sm text-muted-foreground">Razorpay payment is currently not available. Please use UPI or other available methods.</p>
              )}
            </Card>

            {/* UPI QR Option */}
            <Card className="p-4 rounded-xl text-sm shadow-sm border border-gray-200">
              <div className="flex items-center gap-4 mb-6">
                <div
                  className="w-5 h-5 rounded-full border-2 cursor-pointer"
                  onClick={() => setPaymentMethod('upi')}
                  style={{
                    borderColor: paymentMethod === 'upi' ? '#3b82f6' : '#d1d5db',
                    backgroundColor: paymentMethod === 'upi' ? '#3b82f6' : 'transparent',
                  }}
                />
                <div>
                  <h3 className="font-semibold text-lg">Pay via UPI QR</h3>
                  <p className="text-sm text-muted-foreground">Scan QR code to pay instantly</p>
                </div>
              </div>

              {paymentMethod === 'upi' && (
                <div className="space-y-4">
                  {loadingSettings ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : paymentSettings?.upiQrImage ? (
                    <>
                      <div className="flex flex-col items-center gap-4">
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <img
                            src={paymentSettings.upiQrImage}
                            alt="UPI QR Code"
                            className="w-48 h-48 object-contain"
                            onError={(e) => {
                              e.currentTarget.src = '/placeholder.svg';
                            }}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground text-center">
                          {paymentSettings.instructions || 'Scan this QR to pay using any UPI app'}
                        </p>

                        
                      </div>

                      {paymentSettings.upiId && (
                        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                          <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-2">UPI ID</p>
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono flex-1 break-all">{paymentSettings.upiId}</code>
                            <button
                              onClick={copyUpiId}
                              className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900 rounded transition-colors"
                            >
                              {copiedUpiId ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      <form onSubmit={handleUpiSubmit} className="space-y-4">
                        <div>
                          <Label htmlFor="upi-txn-id">Transaction ID / UTR</Label>
                          <Input
                            id="upi-txn-id"
                            type="text"
                            placeholder="e.g., 123456789012345678"
                            value={upiTransactionId}
                            onChange={(e) => setUpiTransactionId(e.target.value)}
                            disabled={submitting}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Enter the transaction ID from your UPI app after payment
                          </p>
                        </div>

                        <Button
                          type="submit"
                          size="lg"
                          className="w-full"
                          disabled={submitting || !upiTransactionId.trim()}
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            'Submit Payment Proof'
                          )}
                        </Button>
                      </form>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">QR code not available</p>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* Order Summary */}
          <div>
            <Card className="p-4 rounded-xl text-sm shadow-sm sticky top-24">
              <h2 className="text-xl font-bold mb-6">Payment Summary</h2>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold">₹{subtotal.toLocaleString('en-IN')}</span>
                </div>

                {appliedCoupon && discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-700 dark:text-green-300">
                    <span>Discount ({appliedCoupon.discount}%)</span>
                    <span>-₹{discountAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between">
                    <span className="font-semibold">Total Amount</span>
                    <span className="text-2xl font-bold text-primary">₹{total.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6 space-y-3">
                <h3 className="font-semibold text-sm">Items ({items.length})</h3>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>{item.title}</span>
                        <span>x{item.qty}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>₹{item.price.toLocaleString('en-IN')} each</span>
                        <span className="font-medium">₹{(item.qty * item.price).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Link to="/cart" className="block mt-6">
                <Button variant="outline" className="w-full">
                  Modify Cart
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CheckoutPayment;
