import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ReviewReply { authorId?: { name?: string }; text: string; createdAt: string }
interface Review {
  _id: string;
  text: string;
  images: string[];
  userId: { name: string };
  createdAt: string;
  replies?: ReviewReply[];
}

interface ReviewsListProps {
  productId: string;
}

const ReviewsList = ({ productId }: ReviewsListProps) => {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const cacheKey = `?productId=${productId}&status=published&page=${pageNum}&limit=10&v=${Date.now()}`;
      const { ok, json } = await api(`/api/reviews${cacheKey}`);
      
      if (!ok) {
        throw new Error(json?.message || 'Failed to load reviews');
      }

      setReviews(json?.data || []);
      setTotalPages(json?.pagination?.pages || 1);
    } catch (err: any) {
      setError(err?.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews(page);
  }, [productId, page]);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Date unknown';
    }
  };

  const renderImage = (src: string) => {
    return src.startsWith('http') ? src : `/api${src.startsWith('/') ? src : `/${src}`}`;
  };

  if (error) {
    return (
      <div className="mt-8 pt-8 border-t border-border">
        <h2 className="text-2xl font-bold tracking-tighter mb-4">Reviews</h2>
        <div className="text-sm text-muted-foreground">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 pt-8 border-t border-border" id="reviews">
      <h2 className="text-2xl font-bold tracking-tighter mb-8">Reviews</h2>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-border rounded-lg p-4 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-2">No reviews yet.</p>
          <p className="text-sm text-muted-foreground">Be the first to share your experience!</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review._id} className="border border-border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm">{review.userId?.name || 'Anonymous'}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</p>
                  </div>
                </div>

                <p className="text-sm text-foreground mb-3 whitespace-pre-wrap">{review.text}</p>

                {review.images && review.images.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {review.images.map((img, idx) => (
                      <div key={idx} className="aspect-square rounded-md overflow-hidden bg-muted">
                        <img
                          src={renderImage(img)}
                          alt={`Review ${idx + 1}`}
                          className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                          onError={(e) => {
                            const el = e.currentTarget as HTMLImageElement;
                            const cur = String(el.src || '');
                            const candidate = cur.includes('/api/uploads')
                              ? cur.replace('/api/uploads', '/uploads')
                              : (cur.includes('/uploads') ? `/api${cur}` : '/placeholder.svg');
                            if (candidate !== cur) el.src = candidate;
                            else el.src = '/placeholder.svg';
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {Array.isArray(review.replies) && review.replies.length > 0 && (
                  <div className="mt-3 rounded-md bg-muted/40 p-3 text-sm">
                    <p className="font-medium mb-2">Store replies</p>
                    <div className="space-y-2">
                      {review.replies.map((r, i) => (
                        <div key={i} className="border-l-2 border-border pl-3">
                          <div className="text-xs text-muted-foreground">
                            {r.authorId?.name || 'Admin'} • {formatDate(r.createdAt)}
                          </div>
                          <div className="whitespace-pre-wrap">{r.text}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6 pt-6 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>

              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReviewsList;
