import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { InvoiceDisplay } from '@/components/InvoiceDisplay';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Order, Invoice, BusinessInfo } from '@/types/database.types';

import { api } from '@/lib/api';

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
}

// Use shared 'api' helper which includes localhost-aware fallbacks for preview environments

export function InvoicePage() {
  const params = useParams<{ id?: string; orderId?: string }>();
  const orderId = params.orderId || params.id || '';
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setError('Order ID is required');
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const orderPromise = api(`/api/orders/${orderId}`).then((res) => {
          if (!res.ok) throw new Error(res.json?.message || `Failed to fetch order (${res.status})`);
          return res.json?.data as Order;
        });

        const businessPromise = (async () => {
          // Try to fetch billing info first
          try {
            const res = await api(`/api/admin/billing-info?v=${Date.now()}`);
            if (res.ok && res.json?.data) {
              return res.json.data as any;
            }
          } catch (e) {
            console.warn('Failed to fetch billing info:', e);
          }
          // Fallback to business settings
          const res = await api(`/api/settings/business`);
          if (!res.ok) return null;
          return res.json?.data as BusinessInfo | null;
        })();

        const invoicePromise = api(`/api/invoices/by-order/${orderId}`).then((res) => {
          if (!res.ok) return null;
          return res.json?.data as Invoice | null;
        }).catch(() => null);

        const [orderData, invoiceData, businessData] = await Promise.all([
          orderPromise,
          invoicePromise,
          businessPromise,
        ]);

        if (!orderData) {
          setError('Order not found');
          return;
        }

        setOrder(orderData);
        setInvoice(invoiceData || null);
        setBusinessInfo(businessData || null);
      } catch (err: any) {
        console.error('Failed to load invoice data:', err);
        setError(err.message || 'Failed to load invoice');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [orderId]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 pt-24 pb-12">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {/* 👇 Invoice scope: force visible text colors */}
        <div
          className="
            bg-white text-foreground
            [--foreground:222.2_84%_4.9%]             /* dark text */
            [--muted-foreground:215.4_16.3%_46.9%]    /* medium gray for labels */
            [--background:0_0%_100%]                  /* white bg (if token missing) */
            dark:[--foreground:210_40%_98%]
            dark:[--muted-foreground:215_20.2%_65.1%]
            dark:bg-gray-950
          "
        >
          <InvoiceDisplay
            order={order}
            invoice={invoice}
            businessInfo={businessInfo}
            isLoading={isLoading}
            error={error}
          />
        </div>

      </main>

    </div>
  );
}
