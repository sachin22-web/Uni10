import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { X, Upload } from 'lucide-react';

interface ReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  orderId?: string;
  onSuccess?: () => void;
}

interface ReviewFormData {
  text: string;
}

export const ReviewModal = ({ open, onOpenChange, productId, orderId, onSuccess }: ReviewModalProps) => {
  const { toast } = useToast();
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ReviewFormData>({
    defaultValues: { text: '' },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (images.length + files.length > 3) {
      toast({ title: 'Maximum 3 images allowed', variant: 'destructive' });
      return;
    }

    for (const file of files) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        toast({ title: `Invalid file type: ${file.type}`, variant: 'destructive' });
        continue;
      }

      if (file.size > 2 * 1024 * 1024) {
        toast({ title: `File too large: ${file.name}`, variant: 'destructive' });
        continue;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/uploads/images', {
          method: 'POST',
          body: formData,
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        const data = await response.json();
        if (data.ok && data.url) {
          setImages(prev => [...prev, data.url]);
        }
      } catch (err) {
        toast({ title: 'Failed to upload image', variant: 'destructive' });
      } finally {
        setUploading(false);
      }
    }

    e.target.value = '';
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (formData: ReviewFormData) => {
    if (formData.text.length < 20 || formData.text.length > 1000) {
      toast({ title: 'Review text must be 20-1000 characters', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const body: any = {
        productId,
        text: formData.text,
        images,
      };

      if (orderId) {
        body.orderId = orderId;
      }

      const { ok, json } = await api('/api/reviews', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!ok) {
        throw new Error(json?.message || 'Failed to submit review');
      }

      toast({ title: 'Review submitted!' });
      onOpenChange(false);
      form.reset();
      setImages([]);
      onSuccess?.();

      setTimeout(() => {
        const reviewsSection = document.getElementById('reviews');
        if (reviewsSection) {
          reviewsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 500);
    } catch (err: any) {
      toast({ title: err?.message || 'Failed to submit review', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Write a Review</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Review Text *</FormLabel>
                  <Textarea
                    {...field}
                    placeholder="Share your thoughts about this product (20-1000 characters)"
                    className="resize-none"
                    rows={5}
                  />
                  <div className="text-xs text-muted-foreground">
                    {field.value.length}/1000
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Images (optional, max 3)</FormLabel>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageUpload}
                disabled={uploading || images.length >= 3}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="flex items-center justify-center gap-2 px-4 py-2 border border-dashed border-input rounded-md cursor-pointer hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="h-4 w-4" />
                <span className="text-sm">{uploading ? 'Uploading...' : 'Click to upload images'}</span>
              </label>

              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-md overflow-hidden bg-muted group">
                      <img src={img} alt={`Review image ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-5 w-5 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || uploading}
                className="flex-1"
              >
                {submitting ? 'Submitting...' : 'Submit Review'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
