import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { ChevronRight, AlertCircle, Loader2 } from 'lucide-react';

type Order = {
  _id: string;
  status: string;
  total: number;
  createdAt: string;
  items: any[];
};

type SupportTicket = {
  _id: string;
  subject: string;
  message: string;
  status: 'open' | 'pending' | 'closed';
  createdAt: string;
  replies?: any[];
};

export default function HelpCenter() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Protect route
  useEffect(() => {
    if (loading) return;
    if (!user) navigate('/auth', { replace: true });
  }, [loading, user, navigate]);

  // Tab state
  const [activeTab, setActiveTab] = useState<'phone' | 'address' | 'cancel' | 'tickets'>('phone');

  // Phone form
  const [phone, setPhone] = useState(user?.phone || '');
  const [savingPhone, setSavingPhone] = useState(false);

  // Address form
  const [address1, setAddress1] = useState(user?.address1 || '');
  const [address2, setAddress2] = useState(user?.address2 || '');
  const [city, setCity] = useState(user?.city || '');
  const [state, setState] = useState(user?.state || '');
  const [pincode, setPincode] = useState(user?.pincode || '');
  const [savingAddress, setSavingAddress] = useState(false);

  // Cancel order
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string>('');
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Support tickets
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [showNewTicketDialog, setShowNewTicketDialog] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketMessage, setNewTicketMessage] = useState('');
  const [newTicketOrderId, setNewTicketOrderId] = useState<string>('');
  const [creatingTicket, setCreatingTicket] = useState(false);

  // Sync user data when user changes
  useEffect(() => {
    if (user) {
      setPhone(user.phone || '');
      setAddress1(user.address1 || '');
      setAddress2(user.address2 || '');
      setCity(user.city || '');
      setState(user.state || '');
      setPincode(user.pincode || '');
    }
  }, [user]);

  // Load orders for cancel tab
  useEffect(() => {
    if (activeTab === 'cancel') {
      fetchOrders();
    }
  }, [activeTab]);

  // Load orders when opening New Ticket dialog
  useEffect(() => {
    if (showNewTicketDialog) {
      fetchOrders();
    }
  }, [showNewTicketDialog]);

  // Load tickets for tickets tab
  useEffect(() => {
    if (activeTab === 'tickets') {
      fetchTickets();
    }
  }, [activeTab]);

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

  const fetchTickets = async () => {
    try {
      setLoadingTickets(true);
      const response = await api('/api/support/tickets/mine');
      if (response.ok && response.json?.ok) {
        setTickets(response.json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch tickets:', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error('Phone number is required');
      return;
    }
    try {
      setSavingPhone(true);
      const response = await api('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ phone }),
      });
      if (response.ok && response.json?.ok) {
        toast.success('Phone number updated successfully');
      } else {
        toast.error(response.json?.message || 'Failed to update phone');
      }
    } catch (err) {
      console.error('Save phone error:', err);
      toast.error('Failed to update phone number');
    } finally {
      setSavingPhone(false);
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address1.trim() || !city.trim() || !state.trim() || !pincode.trim()) {
      toast.error('Address, city, state, and pincode are required');
      return;
    }
    try {
      setSavingAddress(true);
      const response = await api('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ address1, address2, city, state, pincode }),
      });
      if (response.ok && response.json?.ok) {
        toast.success('Address updated successfully');
      } else {
        toast.error(response.json?.message || 'Failed to update address');
      }
    } catch (err) {
      console.error('Save address error:', err);
      toast.error('Failed to update address');
    } finally {
      setSavingAddress(false);
    }
  };

  const cancellableStatuses = ['pending', 'cod_pending', 'pending_verification'];
  const cancellableOrders = orders.filter((o) => cancellableStatuses.includes((o.status || '').toLowerCase()));

  const handleCancelOrder = async (orderId: string) => {
    if (!cancelReason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }
    try {
      setCancellingOrderId(orderId);
      const response = await api(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason }),
      });
      if (response.ok && response.json?.ok) {
        toast.success('Order cancelled successfully');
        setCancelReason('');
        setCancellingOrderId(null);
        await fetchOrders();
      } else {
        toast.error(response.json?.message || 'Failed to cancel order');
      }
    } catch (err) {
      console.error('Cancel order error:', err);
      toast.error('Failed to cancel order');
    } finally {
      setCancellingOrderId(null);
    }
  };

  const handleCreateTicket = async () => {
    if (!newTicketSubject.trim() || !newTicketMessage.trim()) {
      toast.error('Subject and message are required');
      return;
    }
    try {
      setCreatingTicket(true);
      const response = await api('/api/support/tickets', {
        method: 'POST',
        body: JSON.stringify({
          subject: newTicketSubject,
          message: newTicketMessage,
          orderId: newTicketOrderId || undefined,
        }),
      });
      if (response.ok && response.json?.ok) {
        toast.success('Support ticket created successfully');
        setNewTicketSubject('');
        setNewTicketMessage('');
        setNewTicketOrderId('');
        setShowNewTicketDialog(false);
        await fetchTickets();
      } else {
        toast.error(response.json?.message || 'Failed to create ticket');
      }
    } catch (err) {
      console.error('Create ticket error:', err);
      toast.error('Failed to create ticket');
    } finally {
      setCreatingTicket(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      open: 'bg-blue-100 text-blue-800',
      pending: 'bg-yellow-100 text-yellow-800',
      closed: 'bg-green-100 text-green-800',
    };
    return <Badge className={map[status] || 'bg-gray-100 text-gray-800'}>{status}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Help Center</h1>
          <p className="text-muted-foreground">Manage your profile and get support</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b">
          {['phone', 'address', 'cancel', 'tickets'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'phone' && 'Phone'}
              {tab === 'address' && 'Address'}
              {tab === 'cancel' && 'Cancel Order'}
              {tab === 'tickets' && 'Support Tickets'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="max-w-2xl">
          {/* Phone Tab */}
          {activeTab === 'phone' && (
            <Card>
              <CardHeader>
                <CardTitle>Change Phone Number</CardTitle>
                <CardDescription>Update your contact phone number</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSavePhone} className="space-y-4">
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <Button type="submit" disabled={savingPhone}>
                    {savingPhone && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Phone Number
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Address Tab */}
          {activeTab === 'address' && (
            <Card>
              <CardHeader>
                <CardTitle>Change Address</CardTitle>
                <CardDescription>Update your delivery address</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveAddress} className="space-y-4">
                  <div>
                    <Label htmlFor="address1">Address Line 1</Label>
                    <Input
                      id="address1"
                      value={address1}
                      onChange={(e) => setAddress1(e.target.value)}
                      placeholder="123 Main Street"
                    />
                  </div>
                  <div>
                    <Label htmlFor="address2">Address Line 2 (Optional)</Label>
                    <Input
                      id="address2"
                      value={address2}
                      onChange={(e) => setAddress2(e.target.value)}
                      placeholder="Apartment, suite, etc."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
                    </div>
                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input id="state" value={state} onChange={(e) => setState(e.target.value)} placeholder="State" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="pincode">Pincode</Label>
                    <Input id="pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="123456" />
                  </div>
                  <Button type="submit" disabled={savingAddress}>
                    {savingAddress && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Address
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Cancel Order Tab */}
          {activeTab === 'cancel' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Cancel Order</CardTitle>
                  <CardDescription>Cancel pending orders only</CardDescription>
                </CardHeader>
              </Card>
              {loadingOrders ? (
                <div className="space-y-2">
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </div>
              ) : cancellableOrders.length === 0 ? (
                <Card className="p-6">
                  <p className="text-muted-foreground text-center">No cancellable orders found</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {cancellableOrders.map((order) => (
                    <Card key={order._id} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold">Order #{order._id?.slice(0, 8)}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </p>
                          <p className="font-bold mt-1">₹{(order.total || 0).toLocaleString('en-IN')}</p>
                        </div>
                        <Badge variant="outline">{order.status}</Badge>
                      </div>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setCancelReason('')}
                          >
                            Cancel Order
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Cancel Order</DialogTitle>
                            <DialogDescription>Please provide a reason for cancellation</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <Textarea
                              placeholder="Reason for cancellation..."
                              value={cancelReason}
                              onChange={(e) => setCancelReason(e.target.value)}
                              className="min-h-24"
                            />
                            <div className="flex gap-2 justify-end">
                              <Button variant="outline">Cancel</Button>
                              <Button
                                disabled={cancellingOrderId === order._id || !cancelReason.trim()}
                                onClick={() => handleCancelOrder(order._id)}
                              >
                                {cancellingOrderId === order._id && (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                )}
                                Confirm Cancellation
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Support Tickets Tab */}
          {activeTab === 'tickets' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">My Support Tickets</h2>
                  <p className="text-sm text-muted-foreground">Track your support requests</p>
                </div>
                <Dialog open={showNewTicketDialog} onOpenChange={setShowNewTicketDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">+ New Query</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create Support Ticket</DialogTitle>
                      <DialogDescription>Describe your issue or question</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="subject">Subject</Label>
                        <Input
                          id="subject"
                          value={newTicketSubject}
                          onChange={(e) => setNewTicketSubject(e.target.value)}
                          placeholder="Brief subject"
                        />
                      </div>
                      <div>
                        <Label htmlFor="message">Message</Label>
                        <Textarea
                          id="message"
                          value={newTicketMessage}
                          onChange={(e) => setNewTicketMessage(e.target.value)}
                          placeholder="Describe your issue..."
                          className="min-h-24"
                        />
                      </div>
                      <div>
                        <Label htmlFor="orderId">Related Order (Optional)</Label>
                        <Select value={newTicketOrderId} onValueChange={setNewTicketOrderId}>
                          <SelectTrigger id="orderId">
                            <SelectValue placeholder="Select an order" />
                          </SelectTrigger>
                          <SelectContent>
                            {loadingOrders ? (
                              <div className="p-2 text-sm text-muted-foreground">Loading your orders...</div>
                            ) : ordersError === 'unauthorized' ? (
                              <div className="p-2 text-sm text-muted-foreground">Please log in</div>
                            ) : orders.length === 0 ? (
                              <div className="p-2 text-sm text-muted-foreground">No orders found</div>
                            ) : (
                              <>
                                {orders.map((order) => {
                                  const first = Array.isArray(order.items) && order.items.length > 0 ? order.items[0] : null;
                                  const more = Array.isArray(order.items) && order.items.length > 1 ? ` (+${order.items.length - 1})` : '';
                                  const label = `#${order._id?.slice(0, 8)} • ${new Date(order.createdAt).toLocaleDateString()} • ${first ? first.title : 'Items'}${more}`;
                                  return (
                                    <SelectItem key={order._id} value={order._id}>
                                      {label}
                                    </SelectItem>
                                  );
                                })}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setShowNewTicketDialog(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleCreateTicket} disabled={creatingTicket}>
                          {creatingTicket && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Create Ticket
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {loadingTickets ? (
                <div className="space-y-2">
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </div>
              ) : tickets.length === 0 ? (
                <Card className="p-6">
                  <div className="text-center">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">No support tickets yet</p>
                  </div>
                </Card>
              ) : (
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <Card key={ticket._id} className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold">{ticket.subject}</p>
                            {statusBadge(ticket.status)}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{ticket.message.substring(0, 100)}...</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(ticket.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
