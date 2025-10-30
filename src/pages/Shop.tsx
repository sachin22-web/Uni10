import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { ProductCard } from "@/components/ProductCard";
import { SearchInput } from "@/components/SearchInput";
import { Pagination } from "@/components/Pagination";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";

type ProductRow = {
  _id?: string;
  id?: string;
  title?: string;
  name?: string;
  price?: number;
  category?: string;
  image_url?: string;
  images?: string[];
  createdAt?: string;
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
  }
  return s;
};

interface ShopPageProps {
  sortBy?: 'newest' | 'all';
  collectionSlug?: string;
}

const Shop = ({ sortBy = 'all', collectionSlug }: ShopPageProps = {}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [apiCategories, setApiCategories] = useState<string[]>([]);

  const PRODUCTS_PER_PAGE = 20;

  useEffect(() => {
    fetchProducts();
  }, [searchQuery, sortBy, collectionSlug]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const { ok, json } = await api('/api/categories');
        const list = ok && Array.isArray(json?.data) ? (json.data as Array<{ name?: string; slug?: string }>) : [];
        const names = list.map((c) => String(c.name || c.slug || '').trim()).filter(Boolean);
        if (!ignore) setApiCategories(names);
      } catch {
        if (!ignore) setApiCategories([]);
      }
    })();
    return () => { ignore = true; };
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (searchQuery) {
        params.append('q', searchQuery);
      }
      
      if (collectionSlug) {
        params.append('category', collectionSlug);
      }

      const query = params.toString();
      const url = query ? `/api/products?${query}` : '/api/products';
      
      const { ok, json } = await api(url);
      if (!ok) throw new Error(json?.message || json?.error || 'Failed to load');
      
      let list = Array.isArray(json?.data) ? (json.data as ProductRow[]) : [];
      
      // Sort by newest if specified
      if (sortBy === 'newest') {
        list = list.sort((a, b) => {
          const dateA = new Date(a.createdAt || '').getTime();
          const dateB = new Date(b.createdAt || '').getTime();
          return dateB - dateA;
        });
      }
      
      setProducts(list);
      setCurrentPage(1);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const categories = useMemo(() => {
    const cats = new Set<string>(['All']);
    products.forEach((p) => { if (p.category) cats.add(String(p.category)); });
    apiCategories.forEach((n) => { if (n) cats.add(String(n)); });
    return Array.from(cats);
  }, [products, apiCategories]);

  const filteredProducts = useMemo(() => {
    let filtered = selectedCategory === "All" 
      ? products 
      : products.filter((p) => p.category === selectedCategory);
    
    return filtered;
  }, [products, selectedCategory]);

  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);
  const startIdx = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(
    startIdx,
    startIdx + PRODUCTS_PER_PAGE
  );

  const pageTitle = sortBy === 'newest' ? 'New Arrivals' : 'Shop All';
  const pageSubtitle = sortBy === 'newest' 
    ? 'Discover our latest additions'
    : 'Browse our complete collection';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4">
            {pageTitle.split(' ')[0]} <span className="text-primary">{pageTitle.split(' ').slice(1).join(' ')}</span>
          </h1>
          <p className="text-muted-foreground">{pageSubtitle}</p>
        </div>

        <SearchInput 
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search products…"
        />

        <div className="flex flex-wrap gap-2 justify-center mb-12">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              onClick={() => {
                setSelectedCategory(category);
                setCurrentPage(1);
              }}
            >
              {category}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="col-span-full text-center py-12">Loading products...</div>
        ) : paginatedProducts.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground">No products found</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginatedProducts.map((p) => {
                const id = String(p._id || p.id || '');
                const title = p.title || p.name || '';
                const rawImg = p.image_url || (Array.isArray(p.images) ? p.images[0] : '') || '/placeholder.svg';
                const img = resolveImage(rawImg);
                return (
                  <ProductCard
                    key={id}
                    id={id}
                    name={title}
                    price={Number(p.price || 0)}
                    image={img}
                    category={p.category || ''}
                  />
                );
              })}
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Shop;
