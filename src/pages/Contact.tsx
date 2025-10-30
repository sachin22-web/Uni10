import * as React from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { InquiryForm } from '@/components/InquiryForm';
import { api } from '@/lib/api';
import { Phone, Mail, MapPin } from 'lucide-react';

export default function Contact() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<any>(null);

  React.useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        // Try public contact endpoint
        const res = await api(`/api/settings/contact?v=${Date.now()}`);
        if (res.ok && res.json && res.json.data) {
          if (!mounted) return;
          setData(res.json.data || {});
          return;
        }

        // Fallback: try full settings document
        const res2 = await api(`/api/settings?v=${Date.now()}`);
        if (res2.ok && res2.json && res2.json.data) {
          const data = res2.json.data.contact || {};
          if (!mounted) return;
          setData(data || {});
          return;
        }

        throw new Error(res.json?.message || 'Failed to load contact settings');
      } catch (e: any) {
        console.warn('Contact fetch error', e?.message || e);
        if (!mounted) return;
        setError(e?.message || 'Failed to load contact information');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void fetchData();
    return () => { mounted = false; };
  }, []);

  const phones: string[] = (data?.phones && Array.isArray(data.phones) ? data.phones : ['+91 99715 41140']);
  const emails: string[] = (data?.emails && Array.isArray(data.emails) ? data.emails : ['supportinfo@gmail.com','uni10@gmail.com']);
  const address = data?.address || null;
  const mapsUrl = data?.mapsUrl || '';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-extrabold">Contact Us</h1>
            <p className="mt-2 text-muted-foreground max-w-2xl mx-auto">Need help or have a question? Reach out — we're here to help. Our contact details are managed from the admin settings.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="bg-muted rounded p-2"><Phone className="h-5 w-5" /></div>
                  <CardTitle>Phone</CardTitle>
                </div>
                <CardDescription className="mt-1">Call us for order & support inquiries</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ) : error ? (
                  <p className="text-sm text-destructive">{error}</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {phones.map((p, idx) => (
                      <li key={idx}>
                        <a href={`tel:${p}`} className="font-medium text-foreground hover:text-primary">{p}</a>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="bg-muted rounded p-2"><Mail className="h-5 w-5" /></div>
                  <CardTitle>Email</CardTitle>
                </div>
                <CardDescription className="mt-1">Send us your questions and feedback</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ) : error ? (
                  <p className="text-sm text-destructive">{error}</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {emails.map((e, idx) => (
                      <li key={idx}>
                        <a href={`mailto:${e}`} className="font-medium text-foreground hover:text-primary">{e}</a>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="bg-muted rounded p-2"><MapPin className="h-5 w-5" /></div>
                  <CardTitle>Address</CardTitle>
                </div>
                <CardDescription className="mt-1">Visit our office or warehouse</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ) : error ? (
                  <p className="text-sm text-destructive">{error}</p>
                ) : address && (address.line1 || address.city) ? (
                  <div className="text-sm space-y-1">
                    {address.line1 && <div className="font-medium">{address.line1}</div>}
                    {address.line2 && <div>{address.line2}</div>}
                    <div>{(address.city ? address.city + ', ' : '') + (address.state || '')} {address.pincode ? '-' + address.pincode : ''}</div>
                    {mapsUrl && (
                      <div className="mt-2">
                        <a href={mapsUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline text-sm">View on map</a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No address provided</div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>For urgent issues, call us — otherwise we'll respond to emails within one business day.</p>
          </div>

          <div className="mt-16 pt-12 border-t border-border">
            <div className="mb-12">
              <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-3">Send us an Inquiry</h2>
              <p className="text-center text-muted-foreground">Fill out the form below and we'll get back to you soon.</p>
            </div>
            <InquiryForm />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
