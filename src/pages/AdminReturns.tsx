import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface ReturnOrderItem { title?: string; qty?: number; price?: number; image?: string }
interface ReturnOrder {
  _id: string;
  userId?: { _id: string; name?: string; email?: string } | string;
  items: ReturnOrderItem[];
  total: number;
  status: string;
  createdAt: string;
  updatedAt?: string;
  deliveredAt?: string;
  returnStatus?: 'Pending' | 'Approved' | 'Rejected' | 'None';
  returnReason?: string;
  refundUpiId?: string;
  returnRequestedAt?: string;
}

export default function AdminReturns() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ReturnOrder[]>([]);
  const [fetching, setFetching] = useState(true);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('Your return request update');
  const [emailHtml, setEmailHtml] = useState('');
  const [emailSending, setEmailSending] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) navigate('/auth', { replace: true });
      else if (user.role !== 'admin') navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => { void fetchReturns(); }, []);

  const fetchReturns = async () => {
    try {
      setFetching(true);
      const res = await api('/api/orders/returns?v=' + Date.now(), { cache: 'no-store' as any });
      if (res.ok && res.json?.ok) setRows(Array.isArray(res.json.data) ? res.json.data : []);
    } finally {
      setFetching(false);
    }
  };

  const updateStatus = async (orderId: string, value: 'Pending'|'Approved'|'Rejected') => {
    try {
      const { ok } = await api(`/api/orders/${orderId}/admin-update`, {
        method: 'PUT',
        body: JSON.stringify({ returnStatus: value }),
      });
      if (ok) {
        setRows(prev => prev.map(r => r._id === orderId ? { ...r, returnStatus: value, status: value === 'Approved' ? 'returned' : r.status } : r));
        // Auto email (avoid duplicate on Approved - backend sends a templated approval email)
        if (value !== 'Approved') {
          const row = rows.find(r => r._id === orderId);
          const userEmail = (row?.userId && typeof row.userId === 'object') ? (row.userId.email || '') : '';
          if (userEmail) {
            const subj = value === 'Rejected' ? 'Return Rejected' : 'Return Update';
            const html = `<p>Hello ${(row?.userId as any)?.name || ''},</p><p>Your return request for order #${orderId.slice(0,8).toUpperCase()} is <b>${value}</b>.</p>`;
            await api('/api/orders/send-mail', { method: 'POST', body: JSON.stringify({ to: userEmail, subject: subj, html }) });
          }
        }
        toast({ title: 'Status updated' });
      }
    } catch (e:any) {
      toast({ title: e?.message || 'Failed to update', variant: 'destructive' });
    }
  };

  const openEmail = (row: ReturnOrder) => {
    const to = (row.userId && typeof row.userId === 'object') ? (row.userId.email || '') : '';
    setEmailTo(to);
    setEmailSubject('Refund processed for order #' + row._id.slice(0,8).toUpperCase());
    setEmailHtml(`<p>Hello ${(row.userId as any)?.name || ''},</p><p>Your refund for order #${row._id.slice(0,8).toUpperCase()} has been processed to UPI <b>${row.refundUpiId || '-'}</b>.</p>`);
    setEmailOpen(true);
  };

  const sendEmail = async () => {
    try {
      setEmailSending(true);
      const { ok, json } = await api('/api/orders/send-mail', { method: 'POST', body: JSON.stringify({ to: emailTo, subject: emailSubject, html: emailHtml }) });
      if (ok) {
        toast({ title: 'Email sent' });
        setEmailOpen(false);
      } else {
        toast({ title: json?.message || 'Failed to send email', variant: 'destructive' });
      }
    } finally {
      setEmailSending(false);
    }
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Return Requests</h1>
          <p className="text-sm text-muted-foreground">Review and process product return requests</p>
        </div>

        <Card className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2">Order ID</th>
                  <th className="py-2">User Name & Email</th>
                  <th className="py-2">Product Details</th>
                  <th className="py-2">Return Reason</th>
                  <th className="py-2">UPI ID</th>
                  <th className="py-2">Date</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fetching ? (
                  <tr><td className="py-8 text-center text-muted-foreground" colSpan={8}>Loading...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td className="py-8 text-center text-muted-foreground" colSpan={8}>No return requests</td></tr>
                ) : (
                  rows.map(row => {
                    const first = (row.items || [])[0] || {};
                    const d = row.returnRequestedAt || row.updatedAt || row.createdAt;
                    const u = typeof row.userId === 'object' ? row.userId : undefined;
                    return (
                      <tr key={row._id} className="border-b last:border-b-0">
                        <td className="py-2 font-mono">{row._id.slice(0,8).toUpperCase()}</td>
                        <td className="py-2">
                          <div className="flex flex-col">
                            <span>{u?.name || '-'}</span>
                            <span className="text-xs text-muted-foreground">{u?.email || '-'}</span>
                          </div>
                        </td>
                        <td className="py-2">
                          <div className="flex items-center gap-3">
                            <img src={first.image || '/placeholder.svg'} alt={first.title || 'Product'} className="w-10 h-10 object-cover rounded border" />
                            <div>
                              <div className="font-medium truncate max-w-[220px]">{first.title || '-'}</div>
                              <div className="text-xs text-muted-foreground">Qty {first.qty || 0}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 max-w-[240px] pr-4">
                          <div className="line-clamp-2">{row.returnReason || '-'}</div>
                        </td>
                        <td className="py-2">{row.refundUpiId || '-'}</td>
                        <td className="py-2">{new Date(d as any).toLocaleString()}</td>
                        <td className="py-2">
                          <Select value={row.returnStatus || 'Pending'} onValueChange={(v:any)=>updateStatus(row._id, v)}>
                            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Pending">Pending</SelectItem>
                              <SelectItem value="Approved">Approved</SelectItem>
                              <SelectItem value="Rejected">Rejected</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-2">
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={()=>navigate(`/admin/orders/${row._id}/invoice`)}>View</Button>
                            <Button size="sm" onClick={()=>openEmail(row)}>Process Refund</Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>To</Label>
              <Input value={emailTo} onChange={(e)=>setEmailTo(e.target.value)} />
            </div>
            <div>
              <Label>Subject</Label>
              <Input value={emailSubject} onChange={(e)=>setEmailSubject(e.target.value)} />
            </div>
            <div>
              <Label>HTML Content</Label>
<textarea
  className="w-full h-40 border rounded p-2 text-sm
             text-slate-900 dark:text-slate-100
             placeholder:text-slate-500 dark:placeholder:text-slate-400
             caret-primary"
  placeholder="Write HTML here..."
  value={emailHtml}
  onChange={(e)=>setEmailHtml(e.target.value)}
/>


            </div>
            <div className="flex gap-2">
              <Button onClick={sendEmail} disabled={emailSending}>{emailSending ? 'Sending…' : 'Send'}</Button>
              <Button variant="outline" onClick={()=>setEmailOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
