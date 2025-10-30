import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { ChevronRight, Loader2, X, Plus } from 'lucide-react';

type SupportTicket = {
  _id: string;
  subject: string;
  message: string;
  status: 'open' | 'pending' | 'closed';
  createdAt: string;
  productId?: {
    _id: string;
    title: string;
    image?: string;
    price: number;
  };
  orderId?: {
    _id: string;
    status: string;
    total: number;
  };
  purchaseDate?: string;
  replies?: Array<{
    _id?: string;
    authorId: any;
    message: string;
    createdAt: string;
  }>;
};

export default function SupportTickets() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Protect route
  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/auth', { replace: true });
    }
  }, [loading, user, navigate]);

  // State
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [savingReply, setSavingReply] = useState(false);

  // Load tickets
  useEffect(() => {
    if (!user) return;
    fetchTickets();
  }, [user]);

  const fetchTickets = async () => {
    try {
      setLoadingTickets(true);
      const response = await api(`/api/support/tickets/mine?v=${Date.now()}`, { cache: 'no-store' as any });
      if (response.ok && response.json?.ok) {
        setTickets(response.json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch tickets:', err);
      toast.error('Failed to load your tickets');
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleOpenTicket = async (ticketId: string) => {
    try {
      const response = await api(`/api/support/tickets/${ticketId}`);
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
        setSelectedTicket(ticket);
        setReplyMessage('');
        setShowDrawer(true);
      }
    } catch (err) {
      console.error('Failed to fetch ticket:', err);
      toast.error('Failed to load ticket details');
    }
  };

  const handleSaveReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) {
      toast.error('Please write a message');
      return;
    }
    try {
      setSavingReply(true);
      const response = await api(`/api/support/tickets/${selectedTicket._id}/reply`, {
        method: 'POST',
        body: JSON.stringify({
          message: replyMessage,
        }),
      });
      if (response.ok && response.json?.ok) {
        toast.success('Reply sent successfully');
        setReplyMessage('');
        setSelectedTicket(response.json.data);
        await fetchTickets();
      } else {
        toast.error(response.json?.message || 'Failed to send reply');
      }
    } catch (err) {
      console.error('Reply error:', err);
      toast.error('Failed to send reply');
    } finally {
      setSavingReply(false);
    }
  };

  const statusBadgeColor = (status: string) => {
    const map: Record<string, string> = {
      open: 'bg-blue-100 text-blue-800',
      pending: 'bg-yellow-100 text-yellow-800',
      closed: 'bg-green-100 text-green-800',
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!user) {
    return null;
  }

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
              </div>
            </div>
          </aside>

          <section className="flex-1 min-w-0">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">My Support Tickets</h1>
                <p className="text-muted-foreground">View and manage your support requests</p>
              </div>
              <Button onClick={() => navigate('/account/support/new')} size="lg">
                <Plus className="h-4 w-4 mr-2" />
                New Ticket
              </Button>
            </div>

            {/* Tickets List */}
            {loadingTickets ? (
              <div className="space-y-2">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            ) : tickets.length === 0 ? (
              <Card className="p-6">
                <div className="text-center">
                  <p className="text-muted-foreground mb-4">No support tickets yet</p>
                  <Button onClick={() => navigate('/account/support/new')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Ticket
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <Card
                    key={ticket._id}
                    className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => handleOpenTicket(ticket._id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <p className="font-semibold flex-1">{ticket.subject}</p>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={statusBadgeColor(ticket.status)}>{ticket.status}</Badge>
                        </div>
                        {ticket.productId && (
                          <p className="text-sm text-muted-foreground mb-2">
                            <strong>Product:</strong> {ticket.productId.title}
                          </p>
                        )}
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
          </section>
        </div>
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
                  <Badge className={`mt-1 ${statusBadgeColor(selectedTicket?.status || '')}`}>
                    {selectedTicket?.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium mt-1">
                    {selectedTicket?.createdAt ? new Date(selectedTicket.createdAt).toLocaleDateString() : '-'}
                  </p>
                </div>
              </div>
            </div>

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
                      <p className="font-semibold">{selectedTicket.productId.title}</p>
                    </div>
                    {selectedTicket.purchaseDate && (
                      <div>
                        <p className="text-sm text-muted-foreground">Purchase Date</p>
                        <p className="font-semibold">
                          {new Date(selectedTicket.purchaseDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">Price</p>
                      <p className="font-semibold">₹{selectedTicket.productId.price}</p>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Original Message */}
            <div>
              <h3 className="font-semibold mb-2">Issue Description</h3>
              <div className="bg-muted/30 rounded-lg p-3 text-sm">
                {selectedTicket?.message}
              </div>
            </div>

            {/* Replies */}
            {selectedTicket?.replies && selectedTicket.replies.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Conversation</h3>
                <div className="space-y-3">
                  {selectedTicket.replies.map((reply, idx) => (
                    <div key={idx} className="bg-muted/30 rounded-lg p-3 text-sm">
                      <p className="font-medium mb-1">
                        {reply.authorId?.name || 'Unknown'}
                        {reply.authorId?.role === 'admin' && (
                          <Badge variant="outline" className="ml-2">Support Team</Badge>
                        )}
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
            {selectedTicket?.status !== 'closed' && (
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
                      Send Reply
                    </Button>
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
