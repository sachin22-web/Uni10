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
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { ChevronRight, Search, Loader2, X } from 'lucide-react';

type SupportTicket = {
  _id: string;
  subject: string;
  message: string;
  status: 'open' | 'pending' | 'accepted' | 'rejected' | 'closed';
  createdAt: string;
  purchaseDate?: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  orderId?: {
    _id: string;
    status: string;
    paymentMethod: string;
    total: number;
    name: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    items: any[];
  };
  productId?: {
    _id: string;
    title: string;
    image?: string;
    price: number;
  };
  replies?: Array<{
    _id?: string;
    authorId: any;
    message: string;
    createdAt: string;
  }>;
};

export default function SupportCenter() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Protect route - admin only
  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/auth', { replace: true });
    } else if (user.role !== 'admin') {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, user, navigate]);

  // State
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'open' | 'pending' | 'accepted' | 'rejected' | 'closed'>('open');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [newStatus, setNewStatus] = useState<'open' | 'pending' | 'accepted' | 'rejected' | 'closed'>('pending');
  const [savingReply, setSavingReply] = useState(false);

  // Load tickets
  useEffect(() => {
    fetchTickets();
  }, [statusFilter]);

  const fetchTickets = async () => {
    try {
      setLoadingTickets(true);
      const url = `/api/support/admin/tickets?status=${statusFilter}&v=${Date.now()}`;
      const response = await api(url, { cache: 'no-store' as any });
      if (response.ok && response.json?.ok) {
        setTickets(response.json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch tickets:', err);
      toast.error('Failed to load tickets');
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleOpenTicket = async (ticketId: string) => {
    try {
      const response = await api(`/api/support/admin/tickets/${ticketId}?v=${Date.now()}`, { cache: 'no-store' as any });
      if (response.ok && response.json?.ok) {
        let ticket = response.json.data as any;
        // Fallback: fetch product details if image/title missing
        if (ticket?.productId && (!ticket.productId.image || !ticket.productId.title)) {
          const pid = typeof ticket.productId === 'object' ? ticket.productId._id : ticket.productId;
          if (pid) {
            try {
              const pres = await api(`/api/products/${pid}`);
              if (pres.ok && pres.json?.ok && pres.json.data) {
                const p = pres.json.data;
                ticket = {
                  ...ticket,
                  productId: {
                    _id: pid,
                    title: ticket.productId?.title || p.title,
                    image: ticket.productId?.image || p.image_url || (Array.isArray(p.images) ? p.images[0] : undefined),
                    price: ticket.productId?.price || p.price,
                  },
                };
              }
            } catch (e) {
              // ignore
            }
          }
        }
        // Enrich order details if present but missing items/address
        if (ticket?.orderId && (!ticket.orderId.items || ticket.orderId.items.length === 0 || !ticket.orderId.address)) {
          try {
            const oid = typeof ticket.orderId === 'object' ? (ticket.orderId._id || ticket.orderId.id || ticket.orderId) : ticket.orderId;
            const oRes = await api(`/api/admin/orders/${oid}`, { cache: 'no-store' as any });
            if (oRes.ok && oRes.json?.ok && oRes.json.data) {
              const od = oRes.json.data;
              const shipping = od.shipping || {};
              ticket = {
                ...ticket,
                orderId: {
                  _id: od.id || oid,
                  status: od.status || ticket.orderId.status,
                  paymentMethod: od.paymentMethod || ticket.orderId.paymentMethod,
                  total: (od.totals && od.totals.total) || ticket.orderId.total,
                  name: shipping.name || ticket.orderId.name,
                  phone: shipping.phone || ticket.orderId.phone,
                  address: shipping.address1 || ticket.orderId.address,
                  city: shipping.city || ticket.orderId.city,
                  state: shipping.state || ticket.orderId.state,
                  pincode: shipping.pincode || ticket.orderId.pincode,
                  items: Array.isArray(od.items) ? od.items : ticket.orderId.items,
                },
              } as any;
            }
          } catch { }
        }
        setSelectedTicket(ticket);
        setNewStatus(ticket.status);
        setReplyMessage('');
        setShowDrawer(true);
      }
    } catch (err) {
      console.error('Failed to fetch ticket:', err);
      toast.error('Failed to load ticket details');
    }
  };

  const handleSaveReply = async () => {
    if (!selectedTicket || (!replyMessage.trim() && newStatus === selectedTicket.status)) {
      toast.error('Please add a reply or change the status');
      return;
    }
    try {
      setSavingReply(true);
      const response = await api(`/api/support/admin/tickets/${selectedTicket._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: newStatus,
          message: replyMessage || undefined,
        }),
      });
      if (response.ok && response.json?.ok) {
        toast.success('Ticket updated successfully');
        setReplyMessage('');
        setShowDrawer(false);
        await fetchTickets();
      } else {
        toast.error(response.json?.message || 'Failed to update ticket');
      }
    } catch (err) {
      console.error('Save reply error:', err);
      toast.error('Failed to update ticket');
    } finally {
      setSavingReply(false);
    }
  };

  const filteredTickets = useMemo(() => {
    if (!searchQuery.trim()) return tickets;
    const q = searchQuery.toLowerCase();
    return tickets.filter(
      (t) =>
        t.subject.toLowerCase().includes(q) ||
        t.userId?.name.toLowerCase().includes(q) ||
        t.userId?.email.toLowerCase().includes(q) ||
        t._id.toLowerCase().includes(q) || (t.orderId?._id || '').toLowerCase().includes(q)
    );
  }, [tickets, searchQuery]);

  const statusBadgeColor = (status: string) => {
    const map: Record<string, string> = {
      open: 'bg-blue-100 text-blue-800',
      pending: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      closed: 'bg-gray-200 text-gray-800',
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Support Center</h1>
          <p className="text-muted-foreground">Manage customer support tickets</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by subject, customer, email, or ticket ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tickets List */}
        {loadingTickets ? (
          <div className="space-y-2">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : filteredTickets.length === 0 ? (
          <Card className="p-6">
            <p className="text-muted-foreground text-center">No tickets found</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredTickets.map((ticket) => (
              <Card
                key={ticket._id}
                className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => handleOpenTicket(ticket._id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <p className="font-semibold">{ticket.subject}</p>
                      <Badge className={statusBadgeColor(ticket.status)}>{ticket.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>From:</strong> {ticket.userId?.name} ({ticket.userId?.email})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ticket #{ticket._id?.slice(0, 8)} • {new Date(ticket.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Drawer - Ticket Detail */}
      <Drawer open={showDrawer} onOpenChange={setShowDrawer}>
        <DrawerContent className="max-h-[80vh] overflow-y-auto">
          <DrawerHeader className="sticky top-0 bg-background border-b">
            <div className="flex items-start justify-between">
              <div>
                <DrawerTitle>{selectedTicket?.subject}</DrawerTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Ticket #{selectedTicket?._id?.slice(0, 8)}
                </p>
              </div>
              <button
                onClick={() => setShowDrawer(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </DrawerHeader>

          <div className="p-4 space-y-6">
            {/* Ticket Info */}
            <div>
              <h3 className="font-semibold mb-3">Ticket Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Select value={newStatus as any} onValueChange={(v: any) => setNewStatus(v)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium mt-1">
                    {selectedTicket?.createdAt ? new Date(selectedTicket.createdAt).toLocaleDateString() : '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div>
              <h3 className="font-semibold mb-3">Customer Information</h3>
              <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-2">
                <p>
                  <strong>Name:</strong> {selectedTicket?.userId?.name}
                </p>
                <p>
                  <strong>Email:</strong> {selectedTicket?.userId?.email}
                </p>
                {selectedTicket?.userId?.phone && (
                  <p>
                    <strong>Phone:</strong> {selectedTicket.userId.phone}
                  </p>
                )}
              </div>
            </div>

            {/* Original Message */}
            <div>
              <h3 className="font-semibold mb-2">Original Message</h3>
              <div className="bg-muted/30 rounded-lg p-3 text-sm">
                {selectedTicket?.message}
              </div>
            </div>

            {/* Linked Order */}
            {selectedTicket?.orderId && (
              <div>
                <h3 className="font-semibold mb-3">Linked Order</h3>
                <Card className="p-4">
                  <div className="text-sm space-y-2 mb-3">
                    <p>
                      <strong>Order ID:</strong> {selectedTicket.orderId._id?.slice(0, 8)}
                    </p>
                    <p>
                      <strong>Status:</strong> {selectedTicket.orderId.status}
                    </p>
                    <p>
                      <strong>Total:</strong> ₹{selectedTicket.orderId.total}
                    </p>
                    <p>
                      <strong>Payment Method:</strong> {selectedTicket.orderId.paymentMethod}
                    </p>
                  </div>
                  <div className="border-t pt-3 text-sm">
                    <p className="font-semibold mb-2">Shipping Address</p>
                    <p className="text-muted-foreground">
                      {selectedTicket.orderId.name}
                      <br />
                      {selectedTicket.orderId.address}
                      {selectedTicket.orderId.address && ' '}
                      {selectedTicket.orderId.city}, {selectedTicket.orderId.state} {selectedTicket.orderId.pincode}
                      <br />
                      {selectedTicket.orderId.phone}
                    </p>
                  </div>
                  {selectedTicket.orderId.items && selectedTicket.orderId.items.length > 0 && (
                    <div className="border-t pt-3 mt-3">
                      <p className="font-semibold mb-2 text-sm">Order Items</p>
                      <div className="space-y-2">
                        {selectedTicket.orderId.items.map((item: any, idx: number) => {
                          const pid = (item.productId || item.id || '').toString();
                          const highlight = (selectedTicket.productId?._id || selectedTicket.productId)?.toString() === pid;
                          return (
                            <div key={idx} className={`text-xs flex justify-between ${highlight ? 'bg-primary/10 rounded px-2 py-1' : ''}`}>
                              <span>{item.title}</span>
                              <span>
                                x{item.qty} @ ₹{item.price}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <Button size="sm" variant="outline" className="w-full mt-3">
                    View Full Order
                  </Button>
                </Card>
              </div>
            )}

            {/* Linked Product */}
            {selectedTicket?.productId && (
              <div>
                <h3 className="font-semibold mb-3">Product Information</h3>
                <Card className="p-4">
                  <div className="space-y-3">
                    {selectedTicket.productId.image && (
                      <div className="w-full aspect-square bg-muted rounded-lg overflow-hidden">
                        <img
                          src={selectedTicket.productId.image}
                          alt={selectedTicket.productId.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">Product Name</p>
                      <p className="font-semibold text-base">{selectedTicket.productId.title}</p>
                    </div>
                    {selectedTicket.purchaseDate && (
                      <div>
                        <p className="text-sm text-muted-foreground">Purchase Date</p>
                        <p className="font-semibold text-base">
                          {new Date(selectedTicket.purchaseDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">Price</p>
                      <p className="font-semibold text-base">₹{selectedTicket.productId.price}</p>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Replies */}
            {selectedTicket?.replies && selectedTicket.replies.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Conversation</h3>
                <div className="space-y-3">
                  {selectedTicket.replies.map((reply, idx) => (
                    <div key={idx} className="bg-muted/30 rounded-lg p-3 text-sm">
                      <p className="font-medium mb-1">
                        {reply.authorId?.name || 'Unknown'}{' '}
                        {reply.authorId?.role === 'admin' && <Badge variant="outline" className="ml-2">Admin</Badge>}
                      </p>
                      <p className="text-muted-foreground mb-1">{reply.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {reply.createdAt ? new Date(reply.createdAt).toLocaleString() : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reply Form */}
            <div>
              <h3 className="font-semibold mb-3">Add Reply</h3>
              <div className="space-y-3">
                <Textarea
                  placeholder="Type your reply here..."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  className="min-h-24"
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowDrawer(false)}>
                    Close
                  </Button>
                  <Button onClick={handleSaveReply} disabled={savingReply}>
                    {savingReply && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <Footer />
    </div>
  );
}
