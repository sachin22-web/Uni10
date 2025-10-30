import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Loader2 } from 'lucide-react';

type Order = {
  _id: string;
  createdAt: string;
  name?: string;
  phone?: string;
  shipping?: { name?: string; phone?: string };
  items: Array<{
    productId?: string;
    title: string;
    image: string;
    qty: number;
    price: number;
    id?: string;
  }>;
};

type SelectedProduct = {
  productId: string;
  title: string;
  image: string;
  purchaseDate: string;
  orderId: string;
};

export default function NewTicket() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string>('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<SelectedProduct | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Protect route
  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/auth', { replace: true });
    }
  }, [loading, user, navigate]);

  // Load orders
  useEffect(() => {
    if (!user) return;
    fetchOrders();
  }, [user]);

  // Check if prefill from URL params with fallback product lookup
  useEffect(() => {
    const productId = searchParams.get('productId');
    const orderId = searchParams.get('orderId');

    const tryPrefill = async () => {
      // If only orderId is provided, set selected order and preselect first product
      if (orderId && orders.length > 0) {
        const order = orders.find(o => o._id === orderId);
        if (order) {
          setSelectedOrderId(orderId);
          if (order.items && order.items.length > 0 && !productId) {
            const first = order.items[0];
            setSelectedProduct({
              productId: first.productId || first.id || '',
              title: first.title,
              image: first.image,
              purchaseDate: order.createdAt,
              orderId: order._id,
            });
          }
        }
      }

      if (!productId) return;

      // First, try to find in user's orders (to get purchaseDate)
      if (orders.length > 0) {
        const order = orderId ? orders.find(o => o._id === orderId) : orders.find(o => o.items.some(i => i.productId === productId || i.id === productId));
        if (order) {
          const item = order.items.find(i => i.productId === productId || i.id === productId);
          if (item) {
            setSelectedProduct({
              productId: item.productId || item.id || productId,
              title: item.title,
              image: item.image,
              purchaseDate: order.createdAt,
              orderId: order._id,
            });
            return;
          }
        }
      }

      // Fallback: fetch product details if not found in orders
      try {
        const res = await api(`/api/products/${productId}`);
        if (res.ok && res.json?.ok && res.json.data) {
          const p = res.json.data;
          setSelectedProduct({
            productId,
            title: p.title,
            image: p.image_url || (Array.isArray(p.images) ? p.images[0] : ''),
            purchaseDate: '',
            orderId: orderId || '',
          });
        }
      } catch (err) {
        // Silent fail; user can still submit ticket without product attached
      }
    };

    tryPrefill();
  }, [searchParams, orders]);

  const fetchOrders = async () => {
    try {
      setLoadingOrders(true);
      setOrdersError('');
      const response = await api(`/api/orders/mine?v=${Date.now()}`, { cache: 'no-store' as any });
      if (response.ok && response.json?.ok) {
        setOrders(response.json.data || []);
      } else if (response.status === 401) {
        setOrdersError('unauthorized');
      } else {
        setOrdersError('error');
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      setOrdersError('error');
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    const order = orders.find(o => o._id === orderId);
    if (order && order.items.length > 0) {
      const first = order.items[0];
      setSelectedProduct({
        productId: first.productId || first.id || '',
        title: first.title,
        image: first.image,
        purchaseDate: order.createdAt,
        orderId: order._id,
      });
    } else {
      setSelectedProduct(null);
    }
  };

  // Legacy handler kept for compatibility in case other code uses it
  const handleSelectProduct = (productId: string) => {
    const order = orders.find(o =>
      o.items.some(item => item.productId === productId || item.id === productId)
    );
    if (order) {
      const item = order.items.find(i => i.productId === productId || i.id === productId)!;
      setSelectedProduct({
        productId: item.productId || item.id || productId,
        title: item.title,
        image: item.image,
        purchaseDate: order.createdAt,
        orderId: order._id,
      });
      setSelectedOrderId(order._id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    const selectedOrder = selectedOrderId ? orders.find(o => o._id === selectedOrderId) : undefined;
    const orderIdToSend = selectedProduct?.orderId || selectedOrderId || undefined;
    const purchaseDateToSend = selectedProduct?.purchaseDate || (selectedOrder ? selectedOrder.createdAt : undefined);

    try {
      setSubmitting(true);
      const response = await api('/api/support/tickets', {
        method: 'POST',
        body: JSON.stringify({
          subject,
          message,
          productId: selectedProduct?.productId || undefined,
          orderId: orderIdToSend,
          purchaseDate: purchaseDateToSend,
        }),
      });

      if (response.ok && response.json?.ok) {
        toast.success('Ticket created');
        navigate('/account/support');
      } else {
        toast.error(response.json?.message || 'Failed to create ticket');
      }
    } catch (err) {
      console.error('Submit error:', err);
      toast.error('Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!user) {
    return null;
  }

  // Product options, filtered by selected order if chosen
  const productOptions = (selectedOrderId
    ? orders.filter(o => o._id === selectedOrderId)
    : orders
  ).flatMap(order =>
    order.items.map(item => ({
      productId: item.productId || item.id || '',
      title: item.title,
      image: item.image,
      purchaseDate: order.createdAt,
      orderId: order._id,
    }))
  );

  // Parse composite values of form "productId::orderId::idx"
  const parseComposite = (val: string) => {
    if (!val) return { pid: '', orderId: '' };
    const parts = val.split('::');
    return { pid: parts[0] || '', orderId: parts[1] || '' };
  };

  // Handler for composite select values
  const handleSelectProductComposite = (composite: string) => {
    if (!composite) {
      setSelectedProduct(null);
      setSelectedOrderId('');
      return;
    }
    const { pid, orderId } = parseComposite(composite);
    // Prefer orderId to locate the correct order; fallback to searching by pid
    const order = orders.find(o => o._id === orderId) || orders.find(o => o.items.some(i => (i.productId || i.id || '') === pid));
    if (!order) {
      setSelectedProduct(null);
      return;
    }
    const item = order.items.find(i => (i.productId || i.id || '') === pid) || order.items[0];
    if (!item) {
      setSelectedProduct(null);
      return;
    }
    setSelectedProduct({
      productId: item.productId || item.id || pid,
      title: item.title,
      image: item.image,
      purchaseDate: order.createdAt,
      orderId: order._id,
    });
    setSelectedOrderId(order._id);
  };

  const selectedCompositeValue = (() => {
    if (!selectedProduct) return '';
    // Find matching option index within current productOptions
    const idx = productOptions.findIndex(opt => (opt.productId || '') === (selectedProduct.productId || '') && (opt.orderId || '') === (selectedProduct.orderId || ''));
    if (idx === -1) return `${selectedProduct.productId}::${selectedProduct.orderId}::0`;
    return `${selectedProduct.productId}::${selectedProduct.orderId}::${idx}`;
  })();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Create Support Ticket</h1>
          <p className="text-muted-foreground">Tell us about your issue and we'll help you out</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Ticket Details</CardTitle>
                <CardDescription>Fill in the information below to create a support ticket</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Order Selector */}
                  <div>
                    <Label htmlFor="order">Related Order (Optional)</Label>
                    <Select value={selectedOrderId} onValueChange={handleSelectOrder}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select an order..." />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingOrders ? (
                          <div className="p-2 text-sm text-muted-foreground">Loading your orders...</div>
                        ) : ordersError === 'unauthorized' ? (
                          <div className="p-2 text-sm text-muted-foreground">Please log in</div>
                        ) : orders.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground">No orders found.</div>
                        ) : (
                          orders.map((o) => {
                            const first = o.items?.[0];
                            const more = (o.items?.length || 0) > 1 ? ` (+${(o.items.length - 1)})` : '';
                            const label = `#${o._id.slice(0,8)} • ${new Date(o.createdAt).toLocaleDateString()} • ${first ? first.title : 'Items'}${more}`;
                            return (
                              <SelectItem key={o._id} value={o._id}>
                                {label}
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">Choose an order to narrow down products and attach order info.</p>
                  </div>

                  {/* Product Selector */}
                  <div>
                    <Label htmlFor="product">Related Product (Optional)</Label>
                    <Select value={selectedCompositeValue} onValueChange={handleSelectProductComposite}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder={selectedOrderId ? "Select a product from this order..." : "Select a purchased product..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingOrders ? (
                          <div className="p-2 text-sm text-muted-foreground">Loading your orders...</div>
                        ) : productOptions.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground">No products found. You can still create a ticket without selecting a product.</div>
                        ) : (
                          productOptions.map((option, idx) => {
                            const pid = option.productId || '';
                            const composite = `${pid}::${option.orderId || ''}::${idx}`;
                            return (
                              <SelectItem key={composite} value={composite}>
                                {`${option.title} (qty ${orders.find(o=>o._id===option.orderId)?.items.find(i=>(i.productId||i.id||'')===pid)?.qty ?? ''}x)`}
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">Select a product you've purchased to attach it to your ticket</p>
                  </div>

                  {/* Subject */}
                  <div>
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      placeholder="Brief description of your issue"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="mt-2"
                      required
                    />
                  </div>

                  {/* Message */}
                  <div>
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      placeholder="Describe your issue in detail..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="mt-2 min-h-32"
                      required
                    />
                  </div>

                  {/* Submit */}
                  <div className="flex gap-2">
                    <Button type="submit" disabled={submitting}>
                      {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Submit Ticket
                    </Button>
                    <Button type="button" variant="outline" onClick={() => navigate('/account/support')}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Side Panel - Product/Order Preview */}
          <div className="lg:col-span-1">
            {selectedProduct ? (
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle className="text-lg">Selected Product</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Product Image */}
                  {selectedProduct.image && (
                    <div className="w-full aspect-square bg-muted rounded-lg overflow-hidden">
                      <img
                        src={selectedProduct.image}
                        alt={selectedProduct.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Product Name */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Product Name</p>
                    <p className="font-semibold text-base mt-1">{selectedProduct.title}</p>
                  </div>

                  {/* Purchase Date */}
                  {selectedProduct.purchaseDate && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Purchase Date</p>
                      <p className="font-semibold text-base mt-1">
                        {new Date(selectedProduct.purchaseDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}

                  {/* Clear Selection */}
                  <Button
                    variant="outline"
                    onClick={() => setSelectedProduct(null)}
                    className="w-full"
                  >
                    Clear Selection
                  </Button>
                </CardContent>
              </Card>
            ) : selectedOrderId ? (
              (() => {
                const order = orders.find(o => o._id === selectedOrderId);
                const first = order && order.items.length > 0 ? order.items[0] : null;
                const buyerName = order?.shipping?.name || order?.name || '';
                const buyerPhone = order?.shipping?.phone || order?.phone || '';
                return (
                  <Card className="sticky top-24">
                    <CardHeader>
                      <CardTitle className="text-lg">Selected Order</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {first?.image && (
                        <div className="w-full aspect-square bg-muted rounded-lg overflow-hidden">
                          <img src={first.image} alt={first.title} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Buyer</p>
                        <p className="font-semibold text-base mt-1">{buyerName}{buyerPhone ? ` • ${buyerPhone}` : ''}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Order</p>
                        <p className="font-semibold text-base mt-1">#{order?._id.slice(0,8)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Purchase Date</p>
                        <p className="font-semibold text-base mt-1">{order ? new Date(order.createdAt).toLocaleDateString() : '-'}</p>
                      </div>
                      {!first && (
                        <p className="text-sm text-muted-foreground">This order has no items.</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })()
            ) : (
              <Card className="sticky top-24 border-dashed">
                <CardContent className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Select an order and product to attach it to your ticket.
                  </p>
                  {loadingOrders && (
                    <div className="mt-4 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
