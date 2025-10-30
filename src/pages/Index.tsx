import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { FeatureRow } from "@/components/FeatureRow";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { products } from "@/data/products";
import heroImg from "@/assets/hero-cosmic.jpg";
import tshirtImg from "@/assets/product-tshirt-1.jpg";
import pantsImg from "@/assets/product-pants-1.jpg";
import hoodieImg from "@/assets/product-hoodie-1.jpg";
import capImg from "@/assets/product-cap-1.jpg";
import jacketImg from "@/assets/product-jacket-1.jpg";
import backpackImg from "@/assets/product-backpack-1.jpg";
import { NewsTicker } from "@/components/NewsTicker";
import { useEffect, useMemo, useState, useRef } from "react";
import { api } from "@/lib/api";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

// Types aligned with server payloads
type ProductRow = {
  _id?: string;
  id?: string;
  title?: string;
  name?: string;
  price?: number;
  category?: string;
  images?: string[];
  image_url?: string;
  createdAt?: string;
};

type CategoryRow = {
  _id?: string;
  id?: string;
  name?: string;
  slug?: string;
};

type FeatureRowData = {
  key: string;
  title: string;
  link: string;
  imageAlt?: string;
};

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
    }
    return s.startsWith('/') ? `/api${s}` : `/api/${s}`;
  }
  return s;
};

function slugify(input: string) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const Index = () => {
  // Hero rotation state
  const heroImages = [heroImg, tshirtImg, pantsImg, hoodieImg, capImg, jacketImg, backpackImg];
  const categoryLetters = ['T', 'D', 'H'];
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const [nextHeroIndex, setNextHeroIndex] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Feature Rows state
  const [featureRows, setFeatureRows] = useState<FeatureRowData[]>([]);
  const [featureRowsUpdatedAt, setFeatureRowsUpdatedAt] = useState<string>('');
  const [featureRowsLoading, setFeatureRowsLoading] = useState(true);

  // Default feature rows fallback
  const defaultFeatureRows: FeatureRowData[] = [
    { key: 'tshirts', title: 'T-SHIRTS', link: '/collection/t-shirts', imageAlt: 'T-Shirts Collection' },
    { key: 'denims', title: 'DENIMS', link: '/collection/denims', imageAlt: 'Denims Collection' },
    { key: 'hoodies', title: 'HOODIES', link: '/collection/hoodies', imageAlt: 'Hoodies Collection' },
  ];

  // Featured Products state
  const [featuredProducts, setFeaturedProducts] = useState<ProductRow[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredError, setFeaturedError] = useState<string | null>(null);

  // New Arrivals state
  const [newArrivals, setNewArrivals] = useState<ProductRow[]>([]);
  const [newArrivalsLoading, setNewArrivalsLoading] = useState(true);
  const [newArrivalsError, setNewArrivalsError] = useState<string | null>(null);

  // Hero image rotation effect
  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentHeroIndex((prev) => (prev + 1) % heroImages.length);
        setNextHeroIndex((prev) => (prev + 1) % heroImages.length);
        setIsTransitioning(false);
      }, 500);
    }, 4000);

    return () => clearInterval(interval);
  }, [heroImages.length]);

  // Fetch Feature Rows from settings
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setFeatureRowsLoading(true);
        const { ok, json } = await api(`/api/settings/home?v=${Date.now()}`);
        if (!ok) throw new Error(json?.message || json?.error || 'Failed to load settings');
        const rows = Array.isArray(json?.data?.featureRows) ? json.data.featureRows : [];
        const updatedAt = json?.data?.updatedAt || '';
        if (!ignore) {
          setFeatureRows(rows.length > 0 ? rows : defaultFeatureRows);
          setFeatureRowsUpdatedAt(updatedAt);
        }
      } catch (e: any) {
        if (!ignore) {
          setFeatureRows(defaultFeatureRows);
        }
      } finally {
        if (!ignore) setFeatureRowsLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, []);

  // Categories + mixed products state
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);
  const [catsError, setCatsError] = useState<string | null>(null);
  const [mixedProducts, setMixedProducts] = useState<ProductRow[]>([]);
  const [mixedLoading, setMixedLoading] = useState(true);
  const [mixedError, setMixedError] = useState<string | null>(null);
  const [categoryProducts, setCategoryProducts] = useState<Map<string, ProductRow>>(new Map());

  // Fetch Featured Products
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setFeaturedLoading(true);
        setFeaturedError(null);
        const { ok, json } = await api('/api/products?featured=true&limit=4');
        if (!ok) throw new Error(json?.message || json?.error || 'Failed to load');
        let list = Array.isArray(json?.data) ? (json.data as ProductRow[]) : [];
        if (!ignore) setFeaturedProducts(list.slice(0, 4));
      } catch (e: any) {
        if (!ignore) setFeaturedError(e?.message || 'Failed to load featured products');
      } finally {
        if (!ignore) setFeaturedLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, []);

  // Fetch New Arrivals using settings limit (fallback 12)
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setNewArrivalsLoading(true);
        setNewArrivalsError(null);
        const sres = await api(`/api/settings/home?v=${Date.now()}`);
        const lim = Number((sres as any)?.json?.data?.newArrivalsLimit || 0) || 12;
        const { ok, json } = await api(`/api/products?sort=createdAt:desc&limit=${lim}`);
        if (!ok) throw new Error(json?.message || json?.error || 'Failed to load');
        let list = Array.isArray(json?.data) ? (json.data as ProductRow[]) : [];
        // Sort newest first
        list = list.sort((a, b) => {
          const da = new Date(a.createdAt || '').getTime();
          const db = new Date(b.createdAt || '').getTime();
          return db - da;
        });
        if (!ignore) setNewArrivals(list.slice(0, lim));
      } catch (e: any) {
        if (!ignore) setNewArrivalsError(e?.message || 'Failed to load new arrivals');
      } finally {
        if (!ignore) setNewArrivalsLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, []);

  // Fetch top categories and products for each category
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setCatsLoading(true);
        setCatsError(null);
        const { ok, json } = await api('/api/categories');
        if (!ok) throw new Error(json?.message || json?.error || 'Failed to load categories');
        const list = Array.isArray(json?.data) ? (json.data as CategoryRow[]) : [];
        const top = list.slice(0, 8);
        if (!ignore) setCats(top);

        // Fetch one product per category for the category showcase
        setMixedLoading(true);
        setMixedError(null);
        const catMap = new Map<string, ProductRow>();
        const categoryProductsList: ProductRow[] = [];

        for (const cat of top) {
          const catId = cat.slug || cat.name || '';
          const { ok: pOk, json: pJson } = await api(`/api/products?category=${encodeURIComponent(catId)}&limit=1`);
          if (pOk) {
            const products = Array.isArray(pJson?.data) ? (pJson.data as ProductRow[]) : [];
            if (products.length > 0) {
              const prod = products[0];
              catMap.set(catId, prod);
              categoryProductsList.push(prod);
            }
          }
        }

        // Also fetch mixed products for carousel (from categories)
        const pre = await api('/api/products?limit=200');
        if (!pre.ok) throw new Error(pre.json?.message || pre.json?.error || 'Failed to load products');
        let productsAll = Array.isArray(pre.json?.data) ? (pre.json.data as ProductRow[]) : [];
        const catNames = new Set<string>(top.map((c) => c.slug || c.name || ''));
        const filtered = productsAll.filter((p) => p.category && catNames.has(String(p.category)));
        const enriched = filtered.length ? filtered : productsAll;
        const mixed = enriched
          .filter(Boolean)
          .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())
          .slice(0, 12);

        if (!ignore) {
          setCategoryProducts(catMap);
          setMixedProducts(mixed);
        }
      } catch (e: any) {
        if (!ignore) {
          setCatsError(e?.message || 'Failed to load categories');
          setMixedError(e?.message || 'Failed to load products');
          setCats([]);
          setMixedProducts([]);
          setCategoryProducts(new Map());
        }
      } finally {
        if (!ignore) {
          setCatsLoading(false);
          setMixedLoading(false);
        }
      }
    })();
    return () => { ignore = true; };
  }, []);

  // Helpers to map product row to card props
  const mapToCard = (p: ProductRow) => {
    const id = String(p._id || p.id || '');
    const title = p.title || p.name || '';
    const rawImg = p.image_url || (Array.isArray(p.images) ? p.images[0] : '') || (p as any).image || '/placeholder.svg';
    const img = resolveImage(rawImg);
    return { id, name: title, price: Number(p.price || 0), image: img, category: p.category || '' };
  };

  const catSlugForProduct = (p: ProductRow) => {
    const cat = String(p.category || '');
    const found = cats.find((c) => c.slug === cat || c.name === cat);
    if (found?.slug) return found.slug;
    return slugify(cat);
  };

  const topCats = useMemo(() => cats.slice(0, 8), [cats]);

  function NewArrivalsScroller({ items, direction }: { items: ProductRow[]; direction: 'ltr' | 'rtl' }) {
    const rowItems = useMemo(() => {
      // Split into two arrays to vary rows
      const even = items.filter((_, i) => i % 2 === 0);
      const odd = items.filter((_, i) => i % 2 !== 0);
      return direction === 'ltr' ? even : odd;
    }, [items, direction]);

    const contentRef = useRef<HTMLDivElement | null>(null);
    const [duration, setDuration] = useState<number>(20);
    const [paused, setPaused] = useState(false);

    useEffect(() => {
      const node = contentRef.current;
      if (!node) return;
      const W = node.scrollWidth;
      if (!W) return;
      const speed = 120; // px/sec
      const d = Math.max(12, Math.round(W / speed));
      setDuration(d);
    }, [rowItems]);

    if (!rowItems.length) return null;

    return (
      <div
        className={"w-full overflow-hidden select-none"}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        <style>{`
          @keyframes prod-marquee-ltr { from { transform: translateX(-50%); } to { transform: translateX(0); } }
          @keyframes prod-marquee-rtl { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        `}</style>
        <div
          className="flex"
          style={{
            animationName: direction === 'ltr' ? 'prod-marquee-ltr' : 'prod-marquee-rtl',
            animationDuration: `${duration}s`,
            animationTimingFunction: 'linear',
            animationIterationCount: 'infinite',
            animationPlayState: paused ? 'paused' : 'running',
          }}
        >
          <div className="flex items-stretch gap-6 pr-6" ref={contentRef}>
            {rowItems.map((p) => (
              <div key={String(p._id || p.id)} className="w-60">
                <ProductCard {...mapToCard(p)} />
              </div>
            ))}
          </div>
          <div className="flex items-stretch gap-6 pr-6" aria-hidden="true">
            {rowItems.map((p, idx) => (
              <div key={`dup-${idx}-${String(p._id || p.id)}`} className="w-60">
                <ProductCard {...mapToCard(p)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden mt-16">
        <style>{`
          @keyframes fadeInOut {
            0% { opacity: 1; }
            40% { opacity: 1; }
            50% { opacity: 0; }
            60% { opacity: 0; }
            100% { opacity: 1; }
          }
        `}</style>

        {/* Rotating background images */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-500"
          style={{
            backgroundImage: `url(${heroImages[currentHeroIndex]})`,
            opacity: isTransitioning ? 0 : 1,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background"></div>
        </div>

        {/* Next image preloading */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-500"
          style={{
            backgroundImage: `url(${heroImages[nextHeroIndex]})`,
            opacity: isTransitioning ? 1 : 0,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background"></div>
        </div>

        {/* Overlaid Category Letters */}
        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
          <div className="flex gap-8 md:gap-16">
            {categoryLetters.map((letter, idx) => (
              <div
                key={idx}
                className="text-red-500"
                style={{
                  fontSize: 'clamp(120px, 25vw, 400px)',
                  fontWeight: 'bold',
                  lineHeight: 1,
                  letterSpacing: '-0.05em',
                }}
              >
                {letter}
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-center px-3 sm:px-4 max-w-4xl mx-auto">
          <p className="text-xs sm:text-sm tracking-[0.3em] text-primary mb-2 sm:mb-4 uppercase font-medium">
            Welcome to the Universe
          </p>
          <h1 className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-3 sm:mb-6 leading-tight">
            DEFINE YOUR
            <br />
            <span className="text-primary">UNIVERSE With Uni10</span>
          </h1>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto">
            Explore our exclusive collection of premium streetwear and lifestyle products
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link to="/shop" className="w-full sm:w-auto">
              <Button size="lg" className="group w-full sm:w-auto">
                Shop Now
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/shop/new-arrivals" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                New Arrivals
              </Button>
            </Link>
          </div>
          <NewsTicker className="mt-3 sm:mt-4" />
        </div>
      </section>

      {/* Feature Rows Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center opacity-10"
          style={{ backgroundImage: `url(${heroImg})` }}>
        </div>
        {!featureRowsLoading && featureRows.length > 0 && (
          <>
            <FeatureRow
              image={tshirtImg}
              title={featureRows[0]?.title || 'T-SHIRTS'}
              link={featureRows[0]?.link}
              imageAlt={featureRows[0]?.imageAlt}
              letter="T"
            />
            <FeatureRow
              image={pantsImg}
              title={featureRows[1]?.title || 'DENIMS'}
              link={featureRows[1]?.link}
              imageAlt={featureRows[1]?.imageAlt}
              reverse
              letter="D"
            />
            <FeatureRow
              image={hoodieImg}
              title={featureRows[2]?.title || 'HOODIES'}
              link={featureRows[2]?.link}
              imageAlt={featureRows[2]?.imageAlt}
              letter="H"
            />
          </>
        )}
      </section>

      {/* Featured Products */}
      <section className="container mx-auto px-3 sm:px-4 py-12 sm:py-20">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tighter mb-2 sm:mb-4">
            Featured <span className="text-primary">Collection</span>
          </h2>
        </div>

        {featuredLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-lg bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : featuredError ? (
          <div className="text-center text-sm text-muted-foreground mb-12">{featuredError}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {(featuredProducts.length ? featuredProducts : newArrivals.slice(0, 4)).map((product) => (
              <ProductCard key={String(product._id || product.id)} {...mapToCard(product)} />
            ))}
          </div>
        )}

        <div className="text-center mt-8 sm:mt-12">
          <Link to="/shop" className="w-full sm:w-auto inline-block">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              View All Products
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* New Arrivals */}
      <section className="container mx-auto px-3 sm:px-4 pb-12 sm:pb-20">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tighter mb-2 sm:mb-4">
            New <span className="text-primary">Arrivals</span>
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Discover our latest additions</p>
        </div>
        {newArrivalsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-lg bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : newArrivalsError ? (
          <div className="text-center text-sm text-muted-foreground">{newArrivalsError}</div>
        ) : (
          <>
            <NewArrivalsScroller items={newArrivals} direction="ltr" />
            <div className="h-3 sm:h-4" />
            <NewArrivalsScroller items={newArrivals} direction="rtl" />
            <div className="text-center mt-8 sm:mt-12">
              <Link to="/shop/new-arrivals" className="text-xs sm:text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
                View All
              </Link>
            </div>
          </>
        )}
      </section>

      {/* Categories grid with product showcase */}
      <section className="container mx-auto px-3 sm:px-4 pb-12 sm:pb-24">
        <div className="text-center mb-8 sm:mb-10">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tighter mb-2 sm:mb-4">
            Shop by <span className="text-primary">Category</span>
          </h2>
        </div>
        {catsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 mb-8 sm:mb-12">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-lg bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : catsError ? (
          <div className="text-center text-sm text-muted-foreground mb-12">{catsError}</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 mb-8 sm:mb-12">
            {topCats.map((c) => {
              const catId = c.slug || c.name || '';
              const prod = categoryProducts.get(catId);
              const to = `/collection/${c.slug || slugify(c.name || '')}`;
              return prod ? (
                <ProductCard key={String(c._id || c.id || c.slug || c.name)} {...mapToCard(prod)} to={to} />
              ) : (
                <Link key={String(c._id || c.id || c.slug || c.name)} to={to} className="group block rounded-lg border border-border bg-card p-3 sm:p-4 hover:border-primary/50 transition-colors aspect-square flex items-center justify-center">
                  <div className="text-center">
                    <div className="h-12 sm:h-16 w-12 sm:w-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-lg sm:text-xl font-bold mb-2 sm:mb-3 mx-auto">
                      {(c.name || '').slice(0, 1)}
                    </div>
                    <div className="text-xs sm:text-sm font-medium group-hover:text-primary line-clamp-2">{c.name}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 mb-4">
          <h3 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight">From these categories</h3>
          <div className="text-xs sm:text-sm text-muted-foreground">Swipe to explore</div>
        </div>

        {mixedLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-lg bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : mixedError ? (
          <div className="text-center text-sm text-muted-foreground">{mixedError}</div>
        ) : (
          <Carousel opts={{ align: "start", loop: true }}>
            <CarouselContent className="-ml-1 sm:-ml-2 md:-ml-4">
              {mixedProducts.map((p) => {
                const card = mapToCard(p);
                const slug = catSlugForProduct(p);
                const to = `/collection/${slug}`;
                return (
                  <CarouselItem key={String(p._id || p.id)} className="pl-1 sm:pl-2 md:pl-4 basis-1/1.5 sm:basis-1/2 md:basis-1/3 lg:basis-1/4">
                    <ProductCard {...card} to={to} />
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            <div className="mt-4 flex items-center justify-end gap-2">
              <CarouselPrevious />
              <CarouselNext />
            </div>
          </Carousel>
        )}
      </section>

      {/* Banner Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="relative rounded-lg overflow-hidden h-96 flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20"></div>
          <div className="relative z-10 text-center px-4">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-4">
              NEW SEASON
              <br />
              <span className="text-primary">DROP</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-6">
              Exclusive designs. Limited quantities.
            </p>
            <Link to="/shop/new-arrivals">
              <Button size="lg">
                Explore Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
      <PWAInstallPrompt />
      <WhatsAppButton phoneNumber="+91 99964 59921" />
    </div>
  );
};

export default Index;
