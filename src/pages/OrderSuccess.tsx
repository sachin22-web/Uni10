import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Package, MapPin, Mail, ArrowRight, Home } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface OrderItem {
  id: string;
  title: string;
  price: number;
  qty: number;
  image: string;
}

interface Order {
  _id: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  paymentMethod: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  status: string;
  createdAt: string;
}

const OrderSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get('orderId');
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!orderId) {
      navigate('/');
      return;
    }

    fetchOrderDetails();
  }, [orderId, navigate]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const { ok, json } = await api(`/api/orders/${orderId}`);
      
      if (ok && json?.data) {
        setOrder(json.data as Order);
      } else {
        toast.error('Failed to load order details');
        navigate('/my-orders');
      }
    } catch (error) {
      console.error('Fetch order error:', error);
      toast.error('Failed to load order');
      navigate('/my-orders');
    } finally {
      setLoading(false);
    }
  };

  const sendConfirmationEmail = async () => {
    if (!orderId) return;

    try {
      setSending(true);
      const { ok, json } = await api(`/api/orders/${orderId}/email`, {
        method: 'POST',
      });

      if (ok) {
        toast.success('Confirmation email sent successfully!');
      } else {
        toast.error(json?.message || 'Failed to send email');
      }
    } catch (error) {
      console.error('Send email error:', error);
      toast.error('Failed to send confirmation email');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Navbar />
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 pt-24 pb-12">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Order not found</p>
            <Link to="/my-orders" className="text-primary hover:underline mt-4 inline-block">
              View My Orders
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  const displayStatus = order.status.charAt(0).toUpperCase() + order.status.slice(1);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12">
        {/* Success Banner */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <CheckCircle className="h-20 w-20 text-green-500" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4">
            Order <span className="text-green-500">Confirmed!</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Thank you for your order. We've received your order and will start processing it right away.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 max-w-5xl mx-auto mb-8">
          {/* Order Summary Card */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-white rounded-xl shadow-sm border-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Order Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Order ID and Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Order ID</p>
                    <p className="font-semibold text-base">{order._id.substring(0, 12).toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Status</p>
                    <Badge className={statusColors[order.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}>
                      {displayStatus}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Order Date</p>
                    <p className="font-semibold text-base">{new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Payment Method</p>
                    <p className="font-semibold text-base">{order.paymentMethod}</p>
                  </div>
                </div>

                <hr className="my-4" />

                {/* Items */}
                <div>
                  <h3 className="font-semibold mb-4 text-sm">Items ({order.items.length})</h3>
                  <div className="space-y-3">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex gap-4 pb-3 border-b border-border last:border-0">
                        {item.image && (
                          <img
                            src={item.image}
                            alt={item.title}
                            className="w-16 h-16 object-cover rounded-lg bg-muted"
                          />
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.title}</p>
                          <p className="text-xs text-muted-foreground">Qty: {item.qty}</p>
                        </div>
                        <p className="font-semibold text-sm">₹{(item.price * item.qty).toLocaleString('en-IN')}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <hr className="my-4" />

                {/* Price Breakdown */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>₹{order.subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-₹{order.discount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {order.shipping > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shipping</span>
                      <span>₹{order.shipping.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-border">
                    <span>Total Amount</span>
                    <span className="text-primary">₹{order.total.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Shipping Address Card */}
          <div className="space-y-6">
            <Card className="bg-white rounded-xl shadow-sm border-0">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Delivery Address</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p className="font-semibold">{order.name}</p>
                <p className="text-muted-foreground">{order.address}</p>
                <p className="text-muted-foreground">
                  {order.city}, {order.state} {order.pincode}
                </p>
                <p className="text-muted-foreground">
                  <strong>Phone:</strong> {order.phone}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 border-blue-200 rounded-xl shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg text-blue-900">What's Next?</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-blue-900 space-y-3">
                <p>✓ We've received your order</p>
                <p>✓ Confirmation email sent</p>
                <p>✓ You'll get updates on shipping</p>
                <p className="text-xs text-blue-800">Typical delivery: 3-5 business days</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-2xl mx-auto">
          <Button
            onClick={sendConfirmationEmail}
            disabled={sending}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Mail className="h-4 w-4" />
            {sending ? 'Sending...' : 'Resend Confirmation Email'}
          </Button>
          <Link to="/my-orders" className="flex-1 sm:flex-none">
            <Button className="w-full sm:w-auto flex items-center gap-2">
              Track Your Order
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/" className="flex-1 sm:flex-none">
            <Button variant="ghost" className="w-full sm:w-auto flex items-center gap-2">
              <Home className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default OrderSuccess;
