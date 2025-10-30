import { Order, Invoice, BusinessInfo } from '@/types/database.types';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

interface InvoiceDisplayProps {
  order: Order | null;
  invoice: Invoice | null;
  businessInfo: BusinessInfo | null;
  isLoading?: boolean;
  error?: string | null;
}

export function InvoiceDisplay({ order, invoice, businessInfo, isLoading, error }: InvoiceDisplayProps) {
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-muted-foreground">Loading invoice...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive font-semibold mb-2">Error</p>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-muted-foreground">Order not found</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <p className="text-muted-foreground mb-4">No invoice generated yet for this order.</p>
          <p className="text-sm text-muted-foreground">An admin will generate and approve the invoice soon.</p>
        </div>
      </div>
    );
  }

  if (!businessInfo) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-muted-foreground">Business information not available</p>
      </div>
    );
  }

  const subtotal = order.subtotal ?? order.items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discount = order.discount ?? 0;
  const shipping = order.shipping ?? 0;
  const tax = order.tax ?? 0;
  const total = order.total ?? subtotal - discount + shipping + tax;

  const invoiceDate = invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) : '';

  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) : '';

  return (
    <div className="min-h-screen bg-white">
      {/* Print Actions */}
      <div className="no-print sticky top-0 z-10 bg-white border-b border-border p-4 flex gap-2 justify-end">
        <Button onClick={() => window.print()} size="sm" variant="outline">
          <Printer className="h-4 w-4 mr-2" />
          Print / Download
        </Button>
      </div>

      {/* Invoice Content */}
      <div className="print:p-0 p-4 sm:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 pb-8 border-b border-border">
          <div className="flex justify-between items-start mb-6">
            <div>
              {businessInfo.logo && (
                <img src={businessInfo.logo} alt={businessInfo.name} className="h-16 mb-2 object-contain" />
              )}
              <div>
                <h1 className="text-3xl font-black tracking-tighter">{businessInfo.name}</h1>
                <p className="text-sm text-muted-foreground mt-1">{businessInfo.address}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Contact:</p>
              <p className="text-sm font-medium">{businessInfo.phone}</p>
              <p className="text-sm font-medium">{businessInfo.email}</p>
              {businessInfo.gstIn && (
                <>
                  <p className="text-sm text-muted-foreground mt-2">GSTIN:</p>
                  <p className="text-sm font-medium">{businessInfo.gstIn}</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Invoice Meta */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div>
            <p className="text-xs text-muted-foreground uppercase">Invoice No</p>
            <p className="font-semibold">{invoice.invoiceNo}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Invoice Date</p>
            <p className="font-semibold">{invoiceDate}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Order ID</p>
            <p className="font-semibold text-sm">{String(order._id || order.id || '').slice(0, 8)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Order Date</p>
            <p className="font-semibold">{orderDate}</p>
          </div>
        </div>

        {/* Billing & Shipping */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Bill To</p>
            <div className="text-sm space-y-1">
              <p className="font-semibold">{businessInfo?.companyName || 'UNI10'}</p>
              <p>{businessInfo?.address}</p>
              {businessInfo?.contactNumber && <p>{businessInfo.contactNumber}</p>}
              {businessInfo?.email && <p>{businessInfo.email}</p>}
              {businessInfo?.gstinNumber && (
                <>
                  <p className="text-xs text-muted-foreground mt-2">GSTIN:</p>
                  <p>{businessInfo.gstinNumber}</p>
                </>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Ship To</p>
            <div className="text-sm space-y-1">
              <p className="font-semibold">{order.name}</p>
              <p>{order.address}</p>
              <p>
                {order.city}
                {order.state && `, ${order.state}`}
                {order.pincode && ` ${order.pincode}`}
              </p>
              {order.phone && <p>{order.phone}</p>}
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="text-left py-2 font-semibold">Item</th>
                <th className="text-right py-2 font-semibold">Qty</th>
                <th className="text-right py-2 font-semibold">Price</th>
                <th className="text-right py-2 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, idx) => (
                <tr key={idx} className="border-b border-border">
                  <td className="py-3">
                    <div className="flex gap-2">
                      {item.image && (
                        <img src={item.image} alt={item.title} className="w-10 h-10 object-cover rounded" />
                      )}
                      <div>
                        <p className="font-medium">{item.title}</p>
                        {item.variant && (
                          <p className="text-xs text-muted-foreground">
                            {Object.entries(item.variant)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="text-right py-3">{item.qty}</td>
                  <td className="text-right py-3">₹{item.price.toLocaleString('en-IN')}</td>
                  <td className="text-right py-3 font-semibold">₹{(item.price * item.qty).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-full sm:w-80 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount:</span>
                <span>-₹{discount.toLocaleString('en-IN')}</span>
              </div>
            )}
            {shipping > 0 && (
              <div className="flex justify-between text-sm">
                <span>Shipping:</span>
                <span>₹{shipping.toLocaleString('en-IN')}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="flex justify-between text-sm">
                <span>Tax:</span>
                <span>₹{tax.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="border-t border-border pt-2 flex justify-between font-semibold">
              <span>Grand Total:</span>
              <span>₹{total.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border pt-6 text-center text-xs text-muted-foreground">
          <p>Payment Method: {order.paymentMethod}</p>
          <p>Order Status: {order.status}</p>
          {order.upi?.txnId && <p>Transaction ID: {order.upi.txnId}</p>}
          <p className="mt-4 text-xs">Thank you for your business!</p>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
          .print\\:p-0 {
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
