import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import NotFound from './NotFound';

type Page = {
  id: string;
  slug: string;
  name: string;
  content: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
};

const PageDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchPage = async () => {
      try {
        setLoading(true);
        const res = await api('/api/admin/pages/list');
        
        if (res.ok && res.json?.data) {
          const pages = res.json.data as Page[];
          const found = pages.find(p => p.slug === slug && p.status === 'active');
          
          if (found) {
            setPage(found);
          } else {
            setNotFound(true);
          }
        } else {
          setNotFound(true);
        }
      } catch (err) {
        console.error('Failed to fetch page:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchPage();
    }
  }, [slug]);

  if (loading) {
    return (
      <div>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  if (notFound || !page) {
    return <NotFound />;
  }

  return (
    <div>
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <article className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-4">{page.name}</h1>
            <div className="text-sm text-muted-foreground">
              {new Date(page.updatedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>

          <Card className="p-8 rounded-xl shadow-sm">
            <div className="prose prose-invert max-w-none">
              {page.content.split('\n').map((paragraph, idx) => (
                paragraph.trim() && (
                  <p key={idx} className="text-foreground leading-relaxed mb-4">
                    {paragraph}
                  </p>
                )
              ))}
            </div>
          </Card>
        </article>
      </main>
      <Footer />
    </div>
  );
};

export default PageDetail;
