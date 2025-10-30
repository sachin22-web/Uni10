import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ShoppingCart, ArrowLeft, ChevronDown, ChevronUp, Ruler } from "lucide-react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { cn, escapeHtml } from "@/lib/utils";
import { SizeChartModal } from "@/components/SizeChartModal";
import { SizeChartTableModal } from "@/components/SizeChartTableModal";
import { ReviewModal } from "@/components/ReviewModal";
import ReviewsList from "@/components/ReviewsList";
import { AvailableCoupons } from "@/components/AvailableCoupons";

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const resolveImage = (src?: string) => {
  const s = String(src || '');
  if (!s) return '/placeholder.svg';
  if (s.startsWith('http')) return s;
  const isLocalBase = (() => { try { return API_BASE.includes('localhost') || API_BASE.includes('127.0.0.1'); } catch { return false; } })();
  const isHttpsPage = (() => { try { return location.protocol === 'https:'; } catch { return false; } })();
  if (s.startsWith('/uploads') || s.startsWith('uploads')) {
    if (API_BASE && !(isLocalBase && isHttpsPage)) {
      const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
      return s.startsWith('/') ? `${base}${s}` : `${base}/${s}`;
    } else {
      return s.startsWith('/') ? `/api${s}` : `/api/${s}`;
    }
  }
  return s;
};

type P = {
  _id?: string;
  id?: string;
  title?: string;
  name?: string;
  price?: number;
  category?: string;
  description?: string;
  longDescription?: string;
  highlights?: string[];
  specs?: Array<{ key: string; value: string }>;
  stock?: number;
  image_url?: string;
  images?: string[];
  sizes?: string[];
  trackInventoryBySize?: boolean;
  sizeInventory?: Array<{ code: string; label: string; qty: number }>;
  sizeChartUrl?: string;
  sizeChartTitle?: string;
  sizeChart?: {
    title?: string;
    rows?: Array<{ sizeLabel: string; chest: string; brandSize: string }>;
    guidelines?: string;
    diagramUrl?: string;
  };
  updatedAt?: string;
};

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addToCart } = useCart();
  const { user } = useAuth();

  const [product, setProduct] = useState<P | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [showSizeChart, setShowSizeChart] = useState(false);
  const [showSizeChartTable, setShowSizeChartTable] = useState(false);
  const [sizeStockError, setSizeStockError] = useState<string>('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isVerifiedBuyer, setIsVerifiedBuyer] = useState(false);
  const [reviewKey, setReviewKey] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const cacheKey = `?v=${Date.now()}`;
        const { ok, json } = await api(`/api/products/${id}${cacheKey}`);
        if (!ok) throw new Error(json?.message || json?.error || 'Failed to load product');
        setProduct(json?.data as P);
      } catch (e: any) {
        toast({ title: e?.message || 'Failed to load product', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    const checkVerifiedBuyer = async () => {
      if (!user || !product?._id && !product?.id) {
        setIsVerifiedBuyer(false);
        return;
      }

      try {
        const { ok, json } = await api('/api/orders/mine');
        if (!ok || !Array.isArray(json?.data)) {
          setIsVerifiedBuyer(false);
          return;
        }

        const productId = product._id || product.id;
        const hasPurchased = json.data.some(order =>
          Array.isArray(order.items) &&
          order.items.some((item: any) =>
            String(item.productId || item.id) === String(productId)
          )
        );

        setIsVerifiedBuyer(hasPurchased);
      } catch (e) {
        setIsVerifiedBuyer(false);
      }
    };

    checkVerifiedBuyer();
  }, [user, product?._id, product?.id]);

  const img = useMemo(() => resolveImage(product?.image_url || (product?.images?.[0] || '')), [product]);
  const title = product?.title || product?.name || '';

  // Get stock based on per-size inventory or general stock
  const getCurrentStock = useCallback(() => {
    if (product?.trackInventoryBySize && Array.isArray(product?.sizeInventory) && selectedSize) {
      const sizeInfo = product.sizeInventory.find(s => s.code === selectedSize);
      return sizeInfo?.qty ?? 0;
    }
    return Number(product?.stock ?? 0);
  }, [product, selectedSize]);

  const stockNum = useMemo(() => getCurrentStock(), [getCurrentStock]);
  const outOfStock = stockNum === 0;

  const selectedSizeInfo = useMemo(() => {
    if (product?.trackInventoryBySize && Array.isArray(product?.sizeInventory) && selectedSize) {
      return product.sizeInventory.find(s => s.code === selectedSize);
    }
    return null;
  }, [product, selectedSize]);
  const refetchProduct = useCallback(async () => {
    try {
      const cacheKey = `?v=${Date.now()}`;
      const { ok, json } = await api(`/api/products/${id}${cacheKey}`);
      if (ok) setProduct(json?.data as P);
    } catch {}
  }, [id]);

  useEffect(() => {
    const onOrderPlaced = () => { refetchProduct(); };
    window.addEventListener('order:placed', onOrderPlaced);
    return () => window.removeEventListener('order:placed', onOrderPlaced);
  }, [refetchProduct]);

  const handleAddToCart = () => {
    if (!product) return;

    // Check if per-size inventory tracking is enabled
    const usingSizeInventory = product?.trackInventoryBySize && Array.isArray(product?.sizeInventory);

    // If product uses per-size inventory, require size selection
    if (usingSizeInventory && !selectedSize) {
      toast({ title: 'Select a size', description: 'Please choose a size before adding to cart.', variant: 'destructive' });
      return;
    }

    // Check stock based on inventory type
    const currentStock = usingSizeInventory && selectedSize
      ? (product.sizeInventory?.find(s => s.code === selectedSize)?.qty ?? 0)
      : (product.stock ?? 0);

    if (currentStock === 0) {
      const errorMsg = usingSizeInventory && selectedSize ? `Size ${selectedSize} is out of stock` : 'Out of stock';
      setSizeStockError(errorMsg);
      toast({ title: 'Out of stock', variant: 'destructive' });
      return;
    }

    if (quantity > currentStock) {
      const errorMsg = `Only ${currentStock} available${usingSizeInventory && selectedSize ? ` for size ${selectedSize}` : ''}`;
      setSizeStockError(errorMsg);
      toast({ title: 'Insufficient stock', description: errorMsg, variant: 'destructive' });
      return;
    }

    setSizeStockError('');
    const item = { id: String(product._id || product.id || id), title, price: Number(product.price || 0), image: img, meta: {} as any };
    if (selectedSize) item.meta.size = selectedSize;

    if (!user) {
      try { localStorage.setItem('uni_add_intent', JSON.stringify({ item, qty: quantity })); } catch {}
      navigate('/auth');
      return;
    }
    addToCart(item, quantity);
    toast({ title: 'Added to cart!', description: `${title} has been added to your cart.` });
  };

  const handleBuyNow = () => {
    if (!product) return;

    // Check if per-size inventory tracking is enabled
    const usingSizeInventory = product?.trackInventoryBySize && Array.isArray(product?.sizeInventory);

    // If product uses per-size inventory, require size selection
    if (usingSizeInventory && !selectedSize) {
      toast({ title: 'Select a size', description: 'Please choose a size before proceeding to checkout.', variant: 'destructive' });
      return;
    }

    // Check stock based on inventory type
    const currentStock = usingSizeInventory && selectedSize
      ? (product.sizeInventory?.find(s => s.code === selectedSize)?.qty ?? 0)
      : (product.stock ?? 0);

    if (currentStock === 0) {
      const errorMsg = usingSizeInventory && selectedSize ? `Size ${selectedSize} is out of stock` : 'Out of stock';
      setSizeStockError(errorMsg);
      toast({ title: 'Out of stock', variant: 'destructive' });
      return;
    }

    const item = { id: String(product._id || product.id || id), title, price: Number(product.price || 0), image: img, meta: {} as any };
    if (selectedSize) item.meta.size = selectedSize;

    if (!user) {
      try { localStorage.setItem('uni_add_intent', JSON.stringify({ item, qty: 1 })); } catch {}
      navigate('/auth');
      return;
    }
    addToCart(item, 1);
    navigate('/dashboard?checkout=true');
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center">Loading…</div>;
  if (!product) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Product not found</h1>
        <Link to="/shop"><Button>Back to Shop</Button></Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-3 sm:px-4 pt-24 pb-12">
        <Link to="/shop" className="inline-flex items-center text-xs sm:text-sm text-muted-foreground hover:text-foreground mb-6 sm:mb-8">
          <ArrowLeft className="h-4 w-4 mr-2 flex-shrink-0" />
          Back to Shop
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 md:gap-12">
          <div className="aspect-square bg-secondary rounded-lg overflow-hidden">
            <img
              src={img}
              alt={title}
              className="w-full h-full object-cover"
              onError={(e) => {
                try {
                  const el = e.currentTarget as HTMLImageElement;
                  const cur = String(el.src || '');
                  // Try swapping to /api/uploads or /uploads variants before falling back to placeholder
                  const candidate = cur.includes('/api/uploads') ? cur.replace('/api/uploads', '/uploads') : (cur.includes('/uploads') ? `/api${cur}` : '/placeholder.svg');
                  if (candidate !== cur) el.src = candidate;
                  else el.src = '/placeholder.svg';
                } catch { e.currentTarget.src = '/placeholder.svg'; }
              }}
            />
          </div>

          <div>
            <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider mb-2">{product.category}</p>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tighter mb-2 sm:mb-4">{title}</h1>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-6">₹{Number(product.price || 0).toLocaleString('en-IN')}</p>
            <div className="mb-3 sm:mb-4">
              <Badge variant={outOfStock ? 'destructive' : 'secondary'} className="text-xs sm:text-sm">{outOfStock ? 'Not Available' : 'Available'}</Badge>
            </div>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground mb-6 sm:mb-8">{product.description}</p>

            <AvailableCoupons
              onUseNow={(code) => {
                navigate(`/cart?coupon=${encodeURIComponent(code)}`);
              }}
            />

            {/* Per-size inventory display */}
            {product?.trackInventoryBySize && Array.isArray(product?.sizeInventory) && product.sizeInventory.length > 0 && (
              <div className="mb-4 sm:mb-6">
                <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
                  <label className="block text-xs sm:text-sm font-semibold">Size</label>
                  {product.sizeChart ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSizeChartTable(true)}
                      className="text-xs h-auto p-1"
                    >
                      <Ruler className="h-3 w-3 mr-1" />
                      Size Chart
                    </Button>
                  ) : product.sizeChartUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSizeChart(true)}
                      className="text-xs h-auto p-1"
                    >
                      <Ruler className="h-3 w-3 mr-1" />
                      Size Chart
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {product.sizeInventory.map((sizeItem) => {
                    const isOutOfStock = sizeItem.qty === 0;
                    const isLowStock = sizeItem.qty > 0 && sizeItem.qty <= 3;
                    return (
                      <div key={sizeItem.code} className="relative">
                        <button
                          type="button"
                          disabled={isOutOfStock}
                          onClick={() => {
                            setSelectedSize(sizeItem.code);
                            setSizeStockError('');
                          }}
                          className={cn(
                            'px-3 sm:px-4 py-1.5 sm:py-2 rounded border text-xs sm:text-sm font-medium transition-colors',
                            isOutOfStock
                              ? 'opacity-50 cursor-not-allowed bg-muted border-border text-muted-foreground'
                              : selectedSize === sizeItem.code
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-transparent border-border hover:border-primary',
                          )}
                        >
                          {sizeItem.label}
                        </button>
                        {isOutOfStock && (
                          <span className="absolute -bottom-5 left-0 text-xs text-destructive font-medium whitespace-nowrap">
                            Out of stock
                          </span>
                        )}
                        {isLowStock && !isOutOfStock && (
                          <span className="absolute -bottom-5 left-0 text-xs text-orange-600 font-medium whitespace-nowrap">
                            Only {sizeItem.qty} left
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {sizeStockError && (
                  <p className="text-xs text-destructive mt-4">{sizeStockError}</p>
                )}
              </div>
            )}

            {/* Simple sizes (non-inventory tracked) */}
            {!product?.trackInventoryBySize && Array.isArray(product?.sizes) && product.sizes.length > 0 && (
              <div className="mb-4 sm:mb-6">
                <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
                  <label className="block text-xs sm:text-sm font-semibold">Size</label>
                  {product.sizeChart ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSizeChartTable(true)}
                      className="text-xs h-auto p-1"
                    >
                      <Ruler className="h-3 w-3 mr-1" />
                      Size Chart
                    </Button>
                  ) : product.sizeChartUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSizeChart(true)}
                      className="text-xs h-auto p-1"
                    >
                      <Ruler className="h-3 w-3 mr-1" />
                      Size Chart
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {product.sizes.map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => {
                        setSelectedSize(sz);
                        setSizeStockError('');
                      }}
                      className={cn(
                        'px-2.5 sm:px-3 py-1 sm:py-1.5 rounded border text-xs sm:text-sm',
                        selectedSize === sz ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent border-border',
                      )}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-6 sm:mb-8">
              <label className="block text-xs sm:text-sm font-semibold mb-2 sm:mb-3">Quantity</label>
              <div className="flex items-center gap-3 sm:gap-4">
                <Button variant="outline" size="icon" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="h-9 w-9 sm:h-10 sm:w-10">-</Button>
                <span className="font-semibold min-w-[40px] text-center text-sm sm:text-base">{quantity}</span>
                <Button variant="outline" size="icon" onClick={() => setQuantity(quantity + 1)} className="h-9 w-9 sm:h-10 sm:w-10">+</Button>
              </div>
            </div>

 
            <div className="space-y-2 sm:space-y-3">
              {outOfStock || (product?.trackInventoryBySize && !selectedSize) ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="w-full block">
                        <Button size="lg" className="w-full text-xs sm:text-sm h-9 sm:h-11" disabled>
                          <ShoppingCart className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                          Add to Cart
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {outOfStock ? "Out of stock" : "Please select a size"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Button size="lg" className="w-full text-xs sm:text-sm h-9 sm:h-11" onClick={handleAddToCart}>
                  <ShoppingCart className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Add to Cart
                </Button>
              )}
              {!(outOfStock || (product?.trackInventoryBySize && !selectedSize)) && (
                <Button size="lg" className="w-full text-xs sm:text-sm h-9 sm:h-11" onClick={handleBuyNow}>
                  Buy Now
                </Button>
              )}
              {user ? (
                <Button
                  size="lg"
                  variant={isVerifiedBuyer ? 'secondary' : 'outline'}
                  className="w-full text-xs sm:text-sm h-9 sm:h-11"
                  onClick={() => setShowReviewModal(true)}
                  disabled={!isVerifiedBuyer}
                >
                  {isVerifiedBuyer ? 'Write a Review' : 'Available after purchase'}
                </Button>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="w-full block">
                        <Button size="lg" variant="outline" className="w-full text-xs sm:text-sm h-9 sm:h-11" disabled>
                          Write a Review
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Sign in to write a review
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* Product Details Section */}
            {(product?.highlights?.length || product?.specs?.length || product?.longDescription) && (
              <div id="details" className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-border">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tighter mb-6 sm:mb-8">Product Details</h2>

                {/* Highlights Section */}
                {product?.highlights && product.highlights.length > 0 && (
                  <div id="highlights" className="mb-6 sm:mb-8">
                    <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">Highlights</h3>
                    <ul className="space-y-1.5 sm:space-y-2">
                      {product.highlights.map((highlight, idx) => (
                        <li key={idx} className="flex items-start gap-2 sm:gap-3">
                          <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                          <span className="text-xs sm:text-sm text-foreground">{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Specifications Section */}
                {product?.specs && product.specs.length > 0 && (
                  <div id="specs" className="mb-6 sm:mb-8">
                    <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">Specifications</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm">
                        <tbody>
                          {product.specs.map((spec, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-muted/30' : ''}>
                              <td className="px-2 sm:px-4 py-2 sm:py-3 font-medium text-foreground w-1/3 md:w-1/4">{spec.key}</td>
                              <td className="px-2 sm:px-4 py-2 sm:py-3 text-muted-foreground">{spec.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Description Section */}
                {product?.longDescription && (
                  <div id="description" className="mb-6 sm:mb-8">
                    <h3 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">Description</h3>
                    <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed space-y-2">
                      {descriptionExpanded || (product.longDescription.length <= 250) ? (
                        <p className="whitespace-pre-wrap">{escapeHtml(product.longDescription)}</p>
                      ) : (
                        <p className="whitespace-pre-wrap">{escapeHtml(product.longDescription.substring(0, 250))}...</p>
                      )}
                      {product.longDescription.length > 250 && (
                        <button
                          onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                          className="inline-flex items-center gap-1 sm:gap-2 text-primary hover:text-primary/80 font-medium mt-3 sm:mt-4 text-xs sm:text-sm"
                        >
                          {descriptionExpanded ? (
                            <>
                              Read less
                              <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4" />
                            </>
                          ) : (
                            <>
                              Read more
                              <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        <ReviewsList key={reviewKey} productId={product?._id || product?.id || ''} />
      </main>

      <ReviewModal
        open={showReviewModal}
        onOpenChange={setShowReviewModal}
        productId={product?._id || product?.id || ''}
        onSuccess={() => {
          setReviewKey(prev => prev + 1);
        }}
      />

      <SizeChartModal
        open={showSizeChart}
        onOpenChange={setShowSizeChart}
        title={product?.sizeChartTitle || "Size Chart"}
        chartUrl={product?.sizeChartUrl}
      />

      <SizeChartTableModal
        open={showSizeChartTable}
        onOpenChange={setShowSizeChartTable}
        title={product?.sizeChart?.title || `${title} • Size Chart`}
        rows={product?.sizeChart?.rows}
        guidelines={product?.sizeChart?.guidelines}
        diagramUrl={product?.sizeChart?.diagramUrl}
      />

      <Footer />
    </div>
  );
};

export default ProductDetail;
