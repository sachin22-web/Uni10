import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { AdminPages } from '@/components/AdminPages';
import { Pagination } from '@/components/Pagination';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Product, Order, User } from '@/types/database.types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { BarChart, Bar, LineChart, Line, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Loader2,
  Trash2,
  Edit,
  Plus,
  LayoutDashboard,
  Package,
  Receipt,
  Users2,
  CreditCard,
  Truck,
  Tags,
  MessageCircle,
  Megaphone,
  Star,
  Percent,
  Menu,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import slugify from 'slugify';

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || '';
// Using an empty API_BASE defaults to relative '/api' paths which works in preview where backend is proxied.

const ENDPOINTS = {
  products: '/api/products',
  orders: '/api/orders',
  users: '/api/auth/users',
  settings: '/api/settings',
  categories: '/api/categories',
};

type Section = (typeof NAV_ITEMS)[number]['id'];

type PaymentSettingsForm = {
  upiQrImage: string;
  upiId: string;
  beneficiaryName: string;
  instructions: string;
};

type RazorpaySettingsForm = {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  currency: string;
  isActive: boolean;
};

type ShiprocketSettingsForm = {
  enabled: boolean;
  email: string;
  password: string;
  apiKey: string;
  secret: string;
  channelId: string;
};

type BillingInfoForm = {
  companyName: string;
  address: string;
  contactNumber: string;
  email: string;
  gstinNumber: string;
};

type IntegrationSettings = {
  id?: string;
  domain: string;
  payment: PaymentSettingsForm;
  razorpay: RazorpaySettingsForm;
  shipping: { shiprocket: ShiprocketSettingsForm };
};

const NAV_ITEMS = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'categories', label: 'Categories', icon: Tags },
    { id: 'coupons', label: 'Coupon Management', icon: Percent },
    { id: 'pages', label: 'Pages', icon: LayoutDashboard },
    { id: 'orders', label: 'Orders', icon: Receipt },
    { id: 'returns', label: 'Return Requests', icon: Receipt },
    { id: 'users', label: 'Users', icon: Users2 },
    { id: 'reviews', label: 'User Reviews', icon: Star },
    { id: 'notifications', label: 'Notifications', icon: Megaphone },
    { id: 'home', label: 'Home Ticker & New Arrivals', icon: LayoutDashboard },
    { id: 'support', label: 'Support Center', icon: MessageCircle },
    { id: 'contact', label: 'Contact Settings', icon: MessageCircle },
    { id: 'billing', label: 'Company Billing Details', icon: CreditCard },
    { id: 'payment', label: 'Payment Settings', icon: CreditCard },
    { id: 'razorpaySettings', label: 'Razorpay Settings', icon: CreditCard },
    { id: 'shiprocket', label: 'Shiprocket Settings', icon: Truck },
] as const;

function createDefaultPaymentSettings(): PaymentSettingsForm {
  return {
    upiQrImage: '',
    upiId: '',
    beneficiaryName: '',
    instructions: 'Scan QR and pay. Enter UTR/Txn ID on next step.',
  };
}

function createDefaultRazorpaySettings(): RazorpaySettingsForm {
  return {
    keyId: '',
    keySecret: '',
    webhookSecret: '',
    currency: 'INR',
    isActive: false,
  };
}

function createDefaultShiprocketSettings(): ShiprocketSettingsForm {
  return {
    enabled: true,
    email: 'logistics@uni10.in',
    password: 'Test@1234',
    apiKey: 'ship_test_key_123456',
    secret: 'ship_test_secret_abcdef',
    channelId: 'TEST_CHANNEL_001',
  };
}

function createDefaultSettings(): IntegrationSettings {
  return {
    id: undefined,
    domain: 'www.uni10.in',
    payment: createDefaultPaymentSettings(),
    razorpay: createDefaultRazorpaySettings(),
    shipping: {
      shiprocket: createDefaultShiprocketSettings(),
    },
  };
}

function normalizeSettings(raw: any): IntegrationSettings {
  const defaults = createDefaultSettings();

  return {
    id: typeof raw?.id === 'string' ? raw.id : typeof raw?._id === 'string' ? raw._id : undefined,
    domain: typeof raw?.domain === 'string' && raw.domain.trim() ? raw.domain.trim() : defaults.domain,
    payment: {
      upiQrImage:
        typeof raw?.payment?.upiQrImage === 'string'
          ? raw.payment.upiQrImage
          : defaults.payment.upiQrImage,
      upiId:
        typeof raw?.payment?.upiId === 'string' && raw.payment.upiId.trim()
          ? raw.payment.upiId.trim()
          : defaults.payment.upiId,
      beneficiaryName:
        typeof raw?.payment?.beneficiaryName === 'string' && raw.payment.beneficiaryName.trim()
          ? raw.payment.beneficiaryName.trim()
          : defaults.payment.beneficiaryName,
      instructions:
        typeof raw?.payment?.instructions === 'string' && raw.payment.instructions.trim()
          ? raw.payment.instructions.trim()
          : defaults.payment.instructions,
    },
    razorpay: {
      keyId:
        typeof raw?.razorpay?.keyId === 'string' && raw.razorpay.keyId.trim()
          ? raw.razorpay.keyId.trim()
          : defaults.razorpay.keyId,
      keySecret:
        typeof raw?.razorpay?.keySecret === 'string' && raw.razorpay.keySecret.trim()
          ? raw.razorpay.keySecret.trim()
          : defaults.razorpay.keySecret,
      webhookSecret:
        typeof raw?.razorpay?.webhookSecret === 'string' && raw.razorpay.webhookSecret.trim()
          ? raw.razorpay.webhookSecret.trim()
          : defaults.razorpay.webhookSecret,
      currency:
        typeof raw?.razorpay?.currency === 'string' && raw.razorpay.currency.trim()
          ? raw.razorpay.currency.trim()
          : defaults.razorpay.currency,
      isActive:
        typeof raw?.razorpay?.isActive === 'boolean'
          ? raw.razorpay.isActive
          : defaults.razorpay.isActive,
    },
    shipping: {
      shiprocket: {
        enabled:
          typeof raw?.shipping?.shiprocket?.enabled === 'boolean'
            ? raw.shipping.shiprocket.enabled
            : defaults.shipping.shiprocket.enabled,
        email:
          typeof raw?.shipping?.shiprocket?.email === 'string' && raw.shipping.shiprocket.email.trim()
            ? raw.shipping.shiprocket.email.trim()
            : defaults.shipping.shiprocket.email,
        password:
          typeof raw?.shipping?.shiprocket?.password === 'string' && raw.shipping.shiprocket.password
            ? raw.shipping.shiprocket.password
            : defaults.shipping.shiprocket.password,
        apiKey:
          typeof raw?.shipping?.shiprocket?.apiKey === 'string' && raw.shipping.shiprocket.apiKey.trim()
            ? raw.shipping.shiprocket.apiKey.trim()
            : defaults.shipping.shiprocket.apiKey,
        secret:
          typeof raw?.shipping?.shiprocket?.secret === 'string' && raw.shipping.shiprocket.secret.trim()
            ? raw.shipping.shiprocket.secret.trim()
            : defaults.shipping.shiprocket.secret,
        channelId:
          typeof raw?.shipping?.shiprocket?.channelId === 'string' && raw.shipping.shiprocket.channelId.trim()
            ? raw.shipping.shiprocket.channelId.trim()
            : defaults.shipping.shiprocket.channelId,
      },
    },
  };
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const joinUrl = (base: string, p: string) => {
    if (!base) return p;
    if (p.startsWith('http')) return p;
    if (!base.endsWith('/') && !p.startsWith('/')) return `${base}/${p}`;
    if (base.endsWith('/') && p.startsWith('/')) return `${base}${p.slice(1)}`;
    return `${base}${p}`;
  };

  const rawUrl = path.startsWith('http') ? path : joinUrl(API_BASE, path);


  const doFetch = async (targetUrl: string) => {
    const token = (typeof window !== 'undefined') ? localStorage.getItem('token') : null;
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) } as Record<string,string>;
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Use credentials include by default so cookie auth works when same-origin;
    // server CORS already allows credentials for whitelisted origins.
    const fetchOptions: RequestInit = {
      ...options,
      headers,
      credentials: 'include',
      mode: (options.mode as RequestMode) || 'cors',
    };

    try {
      const res = await fetch(targetUrl, fetchOptions);
      let body: any = null;
      try { body = await res.json(); } catch { body = null; }
      if (!res.ok) {
        const msg = body?.message || body?.error || `${res.status} ${res.statusText}`;
        throw new Error(msg);
      }
      if (body && typeof body === 'object' && body !== null && 'data' in body) return body.data as T;
      return body as T;
    } catch (err: any) {
      // Normalize network errors to throw so outer handler can decide fallback
      throw new Error(err?.message || String(err || 'Network error'));
    }
  };

  // If API_BASE points to localhost but frontend is hosted elsewhere (preview), try a relative fallback first
  try {
    if (API_BASE && /localhost|127\.0\.0\.1/.test(API_BASE) && typeof location !== 'undefined' && !location.hostname.includes('localhost') && !location.hostname.includes('127.0.0.1')) {
      const relUrl = path.startsWith('http') ? path : (path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`);
      try {
        return await doFetch(relUrl);
      } catch (relErr) {
        console.warn('Relative /api fetch failed:', relErr?.message || relErr);
        // fallthrough to try configured rawUrl
      }
    }

    // Try configured url
    try {
      return await doFetch(rawUrl);
    } catch (mainErr) {
      // If mixed content (http -> https) try https variant
      if (typeof rawUrl === 'string' && rawUrl.startsWith('http:') && typeof location !== 'undefined' && location.protocol === 'https:') {
        try {
          const httpsUrl = rawUrl.replace(/^http:/, 'https:');
          return await doFetch(httpsUrl);
        } catch (httpsErr) {
          console.warn('HTTPS fallback failed:', httpsErr?.message || httpsErr);
        }
      }

      console.warn('Admin apiFetch network issue — using demo fallback for:', path, (mainErr as any)?.message || mainErr);
      const p = path.toLowerCase();
      if (p.includes('/api/auth/users')) {
        return [
          { _id: 'demo-1', name: 'Sachin', email: 'sachin@gmail.com', role: 'user' },
          { _id: 'demo-2', name: 'UNI10 Admin', email: 'uni10@gmail.com', role: 'admin' },
        ] as unknown as T;
      }
      if (p.includes('/api/products')) {
        return [
          { id: 'prod-1', name: 'Demo Tee', price: 499, category: 'T-Shirts', image_url: '/src/assets/product-tshirt-1.jpg', stock: 10 },
          { id: 'prod-2', name: 'Demo Hoodie', price: 1299, category: 'Hoodies', image_url: '/src/assets/product-hoodie-1.jpg', stock: 5 },
        ] as unknown as T;
      }
      if (p.includes('/api/orders')) {
        return [
          {
            _id: 'order-demo-1',
            id: 'order-demo-1',
            total: 1498,
            total_amount: 1498,
            status: 'pending',
            items: [
              { productId: 'prod-1', name: 'Demo Tee', qty: 2, price: 499 },
            ],
            createdAt: new Date().toISOString(),
            user: { _id: 'demo-1', name: 'Sachin', email: 'sachin@gmail.com' },
          },
        ] as unknown as T;
      }
      if (p.includes('/api/settings')) {
        const demoSettings = createDefaultSettings();
        if ((options?.method || 'GET').toUpperCase() === 'PUT') {
          try {
            const reqBody = options?.body ? JSON.parse(String(options.body)) : {};
            return { ...demoSettings, ...reqBody } as unknown as T;
          } catch {
            return demoSettings as unknown as T;
          }
        }
        return demoSettings as unknown as T;
      }

      return {} as T;
    }
  } catch (outerErr) {
    console.warn('apiFetch unexpected error:', outerErr);
    return {} as T;
  }
}

type ProductFormState = {
  name: string;
  description: string;
  price: number;
  image_url: string;
  categoryId: string;
  subcategoryId: string;
  stock: number;
  sizes: string[];
  trackInventoryBySize: boolean;
  sizeInventory: Array<{ code: string; label: string; qty: number }>;
  sizeChartUrl: string;
  sizeChartTitle: string;
  sizeChart: {
    title: string;
    rows: Array<{ sizeLabel: string; chest: string; brandSize: string }>;
    guidelines: string;
    diagramUrl: string;
  };
  highlights: string[];
  longDescription: string;
  specs: Array<{ key: string; value: string }>;
};

const EMPTY_FORM: ProductFormState = {
  name: '',
  description: '',
  price: 0,
  image_url: '',
  categoryId: '',
  subcategoryId: '',
  stock: 0,
  sizes: [],
  trackInventoryBySize: true,
  sizeInventory: [],
  sizeChartUrl: '',
  sizeChartTitle: '',
  sizeChart: {
    title: '',
    rows: [],
    guidelines: '',
    diagramUrl: '',
  },
  highlights: [],
  longDescription: '',
  specs: [],
};

const Admin = () => {
  const { isAdmin, loading: authLoading, user: adminUser } = useAdminAuth();
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersCurrentPage, setOrdersCurrentPage] = useState(1);
  const ordersPerPage = 13;

  const pendingOrdersCount = useMemo(() => {
    try { return orders.filter((o: any) => String(o.status || '').toLowerCase() === 'pending').length; } catch { return 0; }
  }, [orders]);

  const ordersTotalPages = useMemo(() => {
    return Math.ceil(orders.length / ordersPerPage);
  }, [orders.length]);

  const paginatedOrders = useMemo(() => {
    const startIndex = (ordersCurrentPage - 1) * ordersPerPage;
    const endIndex = startIndex + ordersPerPage;
    return orders.slice(startIndex, endIndex);
  }, [orders, ordersCurrentPage]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalSales: 0,
    totalProducts: 0,
  });
  const [fetching, setFetching] = useState(false);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [productForm, setProductForm] = useState<ProductFormState>(EMPTY_FORM);
  const [categories, setCategories] = useState<any[]>([]);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catSaving, setCatSaving] = useState(false);
  const [topCategories, setTopCategories] = useState<any[]>([]);
  const [childrenByParent, setChildrenByParent] = useState<Record<string, any[]>>({});
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [subcatName, setSubcatName] = useState('');
  const [subcatSaving, setSubcatSaving] = useState(false);

  // User edit drawer state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userDrawerOpen, setUserDrawerOpen] = useState(false);
  const [userForm, setUserForm] = useState<any>({ name: '', email: '', phone: '', role: 'user', status: 'active', address1: '' });
  const [userSaving, setUserSaving] = useState(false);
  const [userErrors, setUserErrors] = useState<Record<string,string>>({});

  // Product bulk selection state
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [selectAllOnPage, setSelectAllOnPage] = useState(false);
  const [selectAllResults, setSelectAllResults] = useState(false);

  // Notifications state
  const [notifySearch, setNotifySearch] = useState('');
  const [notifySelectedIds, setNotifySelectedIds] = useState<Set<string>>(new Set());
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifySending, setNotifySending] = useState(false);

  // Reviews (admin)
  type AdminReview = { _id: string; text: string; rating?: number; createdAt: string; userId?: { name?: string; email?: string }; replies?: Array<{ authorId?: { name?: string; email?: string }, text: string, createdAt: string }> };
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [activeReview, setActiveReview] = useState<AdminReview | null>(null);

  const filteredNotifyUsers = useMemo(() => {
    const q = notifySearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      String(u.name || '').toLowerCase().includes(q) ||
      String(u.email || '').toLowerCase().includes(q)
    );
  }, [users, notifySearch]);

  const allNotifyIds = useMemo(() => (
    filteredNotifyUsers
      .map((u) => String((u as any)._id || (u as any).id || ''))
      .filter((x) => x)
  ), [filteredNotifyUsers]);

  const allNotifySelected = useMemo(() => (
    allNotifyIds.length > 0 && allNotifyIds.every((id) => notifySelectedIds.has(String(id)))
  ), [allNotifyIds, notifySelectedIds]);

  const toggleNotifySelectAll = (checked: boolean) => {
    setNotifySelectedIds(new Set(checked ? allNotifyIds.map(String) : []));
  };

  const toggleNotifyUser = (id: string, checked: boolean) => {
    setNotifySelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(String(id));
      else next.delete(String(id));
      return next;
    });
  };

  const sendNotifications = async () => {
    const ids = Array.from(notifySelectedIds);
    if (ids.length === 0) {
      toast.error('Select at least one user');
      return;
    }
    if (!notifyMessage.trim()) {
      toast.error('Message is required');
      return;
    }
    try {
      setNotifySending(true);
      await apiFetch<any>('/api/admin/notify', {
        method: 'POST',
        body: JSON.stringify({ userIds: ids, message: notifyMessage.trim(), subject: 'Admin Notification' }),
      });
      toast.success('Notification queued to send');
      setNotifySelectedIds(new Set());
      setNotifyMessage('');
    } catch (e: any) {
      toast.error(String(e?.message || 'Failed to send'));
    } finally {
      setNotifySending(false);
    }
  };

  const [settings, setSettings] = useState<IntegrationSettings>(createDefaultSettings);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [paymentForm, setPaymentForm] = useState<PaymentSettingsForm>(createDefaultPaymentSettings);
  const [razorpayForm, setRazorpayForm] = useState<RazorpaySettingsForm>(createDefaultRazorpaySettings);
  const [shiprocketForm, setShiprocketForm] = useState<ShiprocketSettingsForm>(createDefaultShiprocketSettings);
  const [savingPayment, setSavingPayment] = useState(false);

  // Billing info state
  const [billingForm, setBillingForm] = useState<BillingInfoForm>({
    companyName: 'UNI10',
    address: '',
    contactNumber: '',
    email: '',
    gstinNumber: '',
  });
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingSaving, setBillingSaving] = useState(false);
  const [savingRazorpay, setSavingRazorpay] = useState(false);
  const [testingRazorpay, setTestingRazorpay] = useState(false);
  const [savingShiprocket, setSavingShiprocket] = useState(false);
  const [uploadingQrCode, setUploadingQrCode] = useState(false);

  // Contact settings state
  const [contactForm, setContactForm] = useState<{ phones: string[]; emails: string[]; address: { line1?: string; line2?: string; city?: string; state?: string; pincode?: string }; mapsUrl?: string }>(() => ({ phones: ['+91 99715 41140'], emails: ['supportinfo@gmail.com','uni10@gmail.com'], address: {}, mapsUrl: '' }));
  const [contactLoading, setContactLoading] = useState(true);
  const [contactSaving, setContactSaving] = useState(false);

  // Home settings state
  const [homeTicker, setHomeTicker] = useState<Array<{ id: string; text: string; url?: string; startAt?: string; endAt?: string; priority?: number }>>([]);
  const [homeLimit, setHomeLimit] = useState<number>(20);
  const [homeFeatureRows, setHomeFeatureRows] = useState<Array<{ key: string; title: string; link: string; imageAlt?: string }>>([]);
  const [homeLoading, setHomeLoading] = useState<boolean>(false);
  const [homeSaving, setHomeSaving] = useState<boolean>(false);

  // Overview chart state
  const [overviewRange, setOverviewRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [overviewData, setOverviewData] = useState<{
    totals: { revenue: number; orders: number; users: number };
    lastMonth: { revenue: number; orders: number };
    prevMonth: { revenue: number; orders: number };
    series: { date: string; revenue: number; orders: number }[];
  } | null>(null);

  // Order detail drawer state
  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<any | null>(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [orderDetailError, setOrderDetailError] = useState<string | null>(null);

  // Invoice state
  const [orderInvoices, setOrderInvoices] = useState<Record<string, string | null>>({}); // orderId -> invoiceNo
  const [generatingInvoice, setGeneratingInvoice] = useState<Record<string, boolean>>({}); // orderId -> bool

  // Coupon state
  const [coupons, setCoupons] = useState<any[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponDialogOpen, setCouponDialogOpen] = useState(false);
  const [couponForm, setCouponForm] = useState({ code: '', discount: 10, expiryDate: '' });
  const [couponSaving, setCouponSaving] = useState(false);

  const totalSalesFormatted = useMemo(
    () => `₹${stats.totalSales.toLocaleString('en-IN')}`,
    [stats.totalSales],
  );

  const resetForm = () => {
    setProductForm(EMPTY_FORM);
    setEditingProduct(null);
  };

  const startEdit = (product: any) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name ?? product.title ?? '',
      description: product.description ?? product.attributes?.description ?? '',
      price: Number(product.price ?? 0),
      image_url: product.image_url ?? (Array.isArray(product.images) ? product.images[0] : '') ?? '',
      categoryId: (product as any).categoryId || '',
      subcategoryId: (product as any).subcategoryId || '',
      stock: Number(product.stock ?? 0),
      sizes: Array.isArray((product as any).sizes)
        ? (product as any).sizes
        : (Array.isArray((product as any).attributes?.sizes) ? (product as any).attributes.sizes : []),
      trackInventoryBySize: product.trackInventoryBySize ?? true,
      sizeInventory: Array.isArray(product.sizeInventory) ? product.sizeInventory : [],
      sizeChartUrl: product.sizeChartUrl ?? '',
      sizeChartTitle: product.sizeChartTitle ?? '',
      sizeChart: product.sizeChart ?? {
        title: '',
        rows: [],
        guidelines: '',
        diagramUrl: '',
      },
      highlights: Array.isArray(product.highlights) ? product.highlights : [],
      longDescription: product.longDescription ?? '',
      specs: Array.isArray(product.specs) ? product.specs : [],
    });
    setIsDialogOpen(true);
  };

  useEffect(() => {
    setPaymentForm({ ...settings.payment });
    setRazorpayForm({ ...settings.razorpay });
    setShiprocketForm({ ...settings.shipping.shiprocket });
  }, [settings]);

  useEffect(() => {
    if (authLoading) return;

    if (!isAdmin) {
      // If the user is authenticated but not admin, send them to dashboard instead of /auth
      if (adminUser) {
        toast.error('Access denied. Admin privileges required.');
        navigate('/dashboard');
        return;
      }
      // Not authenticated: send to auth page
      navigate('/auth');
      return;
    }

    void fetchAdminResources();
    void fetchIntegrationSettings();
    void fetchCategories();
    // Preload overview stats
    void fetchOverviewStats('30d');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, authLoading, adminUser]);

  // When the admin navigates to different tabs
  useEffect(() => {
    if (activeSection === 'users' && users.length === 0 && isAdmin) {
      void fetchAdminResources();
    }
    if (activeSection === 'overview') {
      void fetchOverviewStats(overviewRange);
    }
    if (activeSection === 'orders') {
      setOrdersCurrentPage(1);
    }
    if (activeSection === 'support') {
      navigate('/admin/support');
    }
    if (activeSection === 'returns') {
      navigate('/admin/returns');
    }
    if (activeSection === 'contact') {
      void fetchContactSettings();
    }
    if (activeSection === 'home') {
      void fetchHomeSettings();
    }
    if (activeSection === 'reviews') {
      void fetchAdminReviews();
    }
    if (activeSection === 'coupons') {
      void fetchCoupons();
    }
    if (activeSection === 'billing') {
      void fetchBillingInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, overviewRange, navigate]);

  const fetchAdminResources = async () => {
    try {
      setFetching(true);
      const [productList, orderList, userList] = await Promise.all([
        apiFetch<Product[]>(ENDPOINTS.products),
        apiFetch<Order[]>(ENDPOINTS.orders),
        apiFetch<User[]>(ENDPOINTS.users).catch(() => [] as User[]),
      ]);

      const safeProducts = Array.isArray(productList) ? productList : [];
      const safeOrders = Array.isArray(orderList) ? orderList : [];
      const safeUsers = Array.isArray(userList) ? userList : [];

      setProducts(safeProducts);
      setOrders(safeOrders);
      setUsers(safeUsers);

      // Populate orderInvoices from existing invoices (non-blocking)
      const invoiceMap: Record<string, string | null> = {};
      for (const order of safeOrders) {
        const orderId = String(order._id || order.id);
        if ((order as any).invoiceId) {
          try {
            const invoiceData = await apiFetch<any>(`/api/invoices/${(order as any).invoiceId}`);
            if (invoiceData?.invoiceNo) {
              invoiceMap[orderId] = invoiceData.invoiceNo;
            }
          } catch (error) {
            // Silently skip if invoice fetch fails - don't break admin load
            console.debug(`Invoice ${(order as any).invoiceId} not found for order ${orderId}`);
          }
        }
      }
      // Only set if we successfully fetched some invoices, otherwise keep empty
      if (Object.keys(invoiceMap).length > 0) {
        setOrderInvoices(invoiceMap);
      }

      const totalSales = safeOrders.reduce(
        (sum, order: any) => sum + Number(order.total ?? order.total_amount ?? 0),
        0,
      );

      setStats({
        totalUsers: safeUsers.length,
        totalSales,
        totalProducts: safeProducts.length,
      });
    } catch (error: any) {
      toast.error(`Failed to fetch admin data: ${error?.message ?? 'Unknown error'}`);
      setProducts([]);
      setOrders([]);
      setUsers([]);
      setStats({ totalUsers: 0, totalSales: 0, totalProducts: 0 });
    } finally {
      setFetching(false);
    }
  };

  const fetchIntegrationSettings = async () => {
    try {
      setSettingsLoading(true);
      const data = await apiFetch<IntegrationSettings>(ENDPOINTS.settings);
      setSettings(normalizeSettings(data));
    } catch (error: any) {
      toast.error(`Failed to load integration settings: ${error?.message ?? 'Unknown error'}`);
      setSettings(createDefaultSettings());
    } finally {
      setSettingsLoading(false);
    }
  };

  const fetchContactSettings = async () => {
    try {
      setContactLoading(true);
      // Try public api helper first (works in preview iframe)
      const res = await api(`/api/settings/contact?v=${Date.now()}`);
      if (res.ok && res.json && res.json.data) {
        const data = res.json.data;
        const phones = Array.isArray(data.phones) && data.phones.length ? data.phones : ['+91 99715 41140'];
        const emails = Array.isArray(data.emails) && data.emails.length ? data.emails : ['supportinfo@gmail.com','uni10@gmail.com'];
        const address = data.address || {};
        const mapsUrl = data.mapsUrl || '';
        setContactForm({ phones, emails, address, mapsUrl });
        return;
      }

      // Fallback: try admin settings doc if public endpoint fails
      const res2 = await api('/api/settings?v=' + Date.now());
      if (res2.ok && res2.json && res2.json.data && res2.json.data.contact) {
        const data = res2.json.data.contact;
        const phones = Array.isArray(data.phones) && data.phones.length ? data.phones : ['+91 99715 41140'];
        const emails = Array.isArray(data.emails) && data.emails.length ? data.emails : ['supportinfo@gmail.com','uni10@gmail.com'];
        const address = data.address || {};
        const mapsUrl = data.mapsUrl || '';
        setContactForm({ phones, emails, address, mapsUrl });
        return;
      }

      // Last resort defaults
      setContactForm({ phones: ['+91 99715 41140'], emails: ['supportinfo@gmail.com','uni10@gmail.com'], address: {}, mapsUrl: '' });
    } catch (e:any) {
      console.warn('Failed to load contact settings', e?.message || e);
      setContactForm({ phones: ['+91 99715 41140'], emails: ['supportinfo@gmail.com','uni10@gmail.com'], address: {}, mapsUrl: '' });
    } finally {
      setContactLoading(false);
    }
  };

  const fetchHomeSettings = async () => {
    try {
      setHomeLoading(true);
      const res = await api(`/api/settings/home?v=${Date.now()}`);
      if (res.ok && res.json && res.json.data) {
        const data: any = res.json.data;
        const ticker = Array.isArray(data.ticker) ? data.ticker : [];
        const limit = Number(data.newArrivalsLimit || 0) || 20;
        const featureRows = Array.isArray(data.featureRows) ? data.featureRows : [];
        setHomeTicker(ticker.map((x:any)=>({ id: String(x.id || ''), text: String(x.text || ''), url: x.url || '', startAt: x.startAt || '', endAt: x.endAt || '', priority: Number(x.priority || 0) })));
        setHomeLimit(limit);
        setHomeFeatureRows(featureRows.map((fr:any)=>({ key: String(fr.key || ''), title: String(fr.title || ''), link: String(fr.link || ''), imageAlt: String(fr.imageAlt || '') })));
      } else {
        setHomeTicker([]);
        setHomeLimit(20);
        setHomeFeatureRows([]);
      }
    } catch (e:any) {
      console.warn('Failed to load home settings', e?.message || e);
      setHomeTicker([]);
      setHomeLimit(20);
      setHomeFeatureRows([]);
    } finally {
      setHomeLoading(false);
    }
  };

  const saveHomeSettings = async () => {
    try {
      setHomeSaving(true);
      const payload = {
        home: {
          ticker: homeTicker.map((x)=>({ ...x, text: String(x.text || '').trim() })).filter((x)=>x.text.length>0),
          newArrivalsLimit: homeLimit,
          featureRows: homeFeatureRows.filter((fr)=>fr.key && fr.title && fr.link),
        }
      };
      await apiFetch<any>(`/api/settings/home`, { method: 'PATCH', body: JSON.stringify(payload) });
      toast.success('Home settings updated');
      await fetchHomeSettings();
    } catch (e:any) {
      toast.error(e?.message || 'Failed to save home settings');
    } finally {
      setHomeSaving(false);
    }
  };

  const saveContactSettings = async () => {
    try {
      setContactSaving(true);
      const payload = { phones: contactForm.phones.filter(Boolean), emails: contactForm.emails.filter(Boolean), address: contactForm.address, mapsUrl: contactForm.mapsUrl };
      await apiFetch<any>(`/api/admin/settings/contact?v=${Date.now()}`, { method: 'PATCH', body: JSON.stringify(payload) });
      toast.success('Contact settings updated');
      await fetchContactSettings();
    } catch (e:any) {
      toast.error(e?.message || 'Failed to save contact settings');
    } finally {
      setContactSaving(false);
    }
  };

  const fetchBillingInfo = async () => {
    try {
      setBillingLoading(true);
      const res = await api(`/api/admin/billing-info?v=${Date.now()}`);
      if (res.ok && res.json && res.json.data) {
        const data = res.json.data;
        setBillingForm({
          companyName: String(data.companyName || 'UNI10'),
          address: String(data.address || ''),
          contactNumber: String(data.contactNumber || ''),
          email: String(data.email || ''),
          gstinNumber: String(data.gstinNumber || ''),
        });
      } else {
        setBillingForm({
          companyName: 'UNI10',
          address: '',
          contactNumber: '',
          email: '',
          gstinNumber: '',
        });
      }
    } catch (e:any) {
      console.warn('Failed to load billing info', e?.message || e);
      setBillingForm({
        companyName: 'UNI10',
        address: '',
        contactNumber: '',
        email: '',
        gstinNumber: '',
      });
    } finally {
      setBillingLoading(false);
    }
  };

  const saveBillingInfo = async () => {
    try {
      setBillingSaving(true);
      if (!billingForm.companyName.trim()) {
        toast.error('Company name is required');
        return;
      }
      if (!billingForm.address.trim()) {
        toast.error('Address is required');
        return;
      }
      if (!billingForm.contactNumber.trim()) {
        toast.error('Contact number is required');
        return;
      }
      if (!billingForm.email.trim()) {
        toast.error('Email is required');
        return;
      }
      if (!billingForm.gstinNumber.trim()) {
        toast.error('GSTIN number is required');
        return;
      }
      const payload = {
        companyName: billingForm.companyName.trim(),
        address: billingForm.address.trim(),
        contactNumber: billingForm.contactNumber.trim(),
        email: billingForm.email.trim(),
        gstinNumber: billingForm.gstinNumber.trim(),
      };
      const res = await api(`/api/admin/billing-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(res.json?.message || 'Failed to save billing info');
      }
      toast.success('Company billing details saved');
      await fetchBillingInfo();
    } catch (e:any) {
      toast.error(e?.message || 'Failed to save billing info');
    } finally {
      setBillingSaving(false);
    }
  };

  const fetchCategories = async () => {
    try {
      // Try public categories endpoint with cache-bust
      const url = `${ENDPOINTS.categories}?v=${Date.now()}`;
      const data = await apiFetch<any[]>(url);
      const arr = Array.isArray(data) ? data : (Array.isArray((data as any)?.data) ? (data as any).data : []);
      // If backend supports parent relations, compute topCategories
      const top = arr.filter((c:any) => !c.parent && !c.parentId);
      setTopCategories(top.length ? top : arr);
      setCategories(arr);
    } catch (e: any) {
      console.warn('Failed to load categories', e?.message || e);
      setTopCategories([]);
      setCategories([]);
    }
  };

  const fetchChildren = async (parentId: string) => {
    if (!parentId) return;
    try {
      // Try endpoint that may support parent filter
      try {
        const kids = await apiFetch<any[]>(`${ENDPOINTS.categories}?parent=${parentId}&v=${Date.now()}`);
        const arr = Array.isArray(kids) ? kids : (Array.isArray((kids as any)?.data) ? (kids as any).data : []);
        setChildrenByParent((m) => ({ ...m, [parentId]: arr }));
        return;
      } catch (e) {
        // fallback to client-side filter if API doesn't support parent query
      }

      const all = await apiFetch<any[]>(`${ENDPOINTS.categories}?v=${Date.now()}`);
      const allArr = Array.isArray(all) ? all : (Array.isArray((all as any)?.data) ? (all as any).data : []);
      const filtered = allArr.filter((c:any) => (c.parent === parentId || c.parentId === parentId || String(c.parent || c.parentId || '') === String(parentId)));
      setChildrenByParent((m) => ({ ...m, [parentId]: filtered }));
    } catch (e: any) {
      console.warn('Failed to load subcategories', e?.message || e);
      setChildrenByParent((m) => ({ ...m, [parentId]: [] }));
    }
  };

  const fetchOverviewStats = async (range: '7d' | '30d' | '90d') => {
    try {
      setOverviewLoading(true);
      setOverviewError(null);
      const data = await apiFetch<{ totals: any; lastMonth: any; prevMonth: any; series: any[] }>(`/api/admin/stats/overview?range=${range}`);
      setOverviewData({
        totals: {
          revenue: Number((data as any)?.totals?.revenue || 0),
          orders: Number((data as any)?.totals?.orders || 0),
          users: Number((data as any)?.totals?.users || 0),
        },
        lastMonth: {
          revenue: Number((data as any)?.lastMonth?.revenue || 0),
          orders: Number((data as any)?.lastMonth?.orders || 0),
        },
        prevMonth: {
          revenue: Number((data as any)?.prevMonth?.revenue || 0),
          orders: Number((data as any)?.prevMonth?.orders || 0),
        },
        series: Array.isArray((data as any)?.series) ? (data as any).series : [],
      });
    } catch (e: any) {
      setOverviewError(e?.message || 'Failed to load stats');
      setOverviewData(null);
    } finally {
      setOverviewLoading(false);
    }
  };

  const openOrderDetail = async (id: string) => {
    setSelectedOrderId(id);
    setOrderDrawerOpen(true);
    setOrderDetail(null);
    setOrderDetailError(null);
    setOrderDetailLoading(true);
    try {
      const data = await apiFetch<any>(`/api/admin/orders/${id}`);
      setOrderDetail(data);
    } catch (e: any) {
      setOrderDetailError(e?.message || 'Failed to load order');
    } finally {
      setOrderDetailLoading(false);
    }
  };

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      toast.error('Category name is required');
      return;
    }
    try {
      setCatSaving(true);
      // Use public categories endpoint
      await apiFetch(`${ENDPOINTS.categories}`, { method: 'POST', body: JSON.stringify({ name: catName.trim(), slug: slugify(catName.trim(), { lower: true, strict: true }), parentId: undefined, description: catDesc }) });
      toast.success('Category added successfully');
      setCatName('');
      setCatDesc('');
      await fetchCategories();
    } catch (err: any) {
      console.error('Add category error:', err);
      toast.error(err?.message || 'Failed to add category');
    } finally {
      setCatSaving(false);
    }
  };

  const deleteCategory = async (id: string) => {
    const ok = confirm('Delete this category?');
    if (!ok) return;
    try {
      await apiFetch(`${ENDPOINTS.categories}/${id}`, { method: 'DELETE' });
      toast.success('Category deleted');
      await fetchCategories();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete category');
    }
  };

  const addSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParentId) {
      toast.error('Select a parent category');
      return;
    }
    if (!subcatName.trim()) {
      toast.error('Subcategory name is required');
      return;
    }
    try {
      setSubcatSaving(true);
      await apiFetch(`${ENDPOINTS.categories}`, { method: 'POST', body: JSON.stringify({ name: subcatName.trim(), slug: slugify(subcatName.trim(), { lower: true, strict: true }), parentId: selectedParentId }) });
      toast.success('Subcategory added');
      setSubcatName('');
      await fetchChildren(selectedParentId);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add subcategory');
    } finally {
      setSubcatSaving(false);
    }
  };

  const editCategoryName = async (id: string, currentName: string) => {
    const newName = prompt('Edit name', currentName || '');
    if (!newName) return;
    try {
      await apiFetch(`${ENDPOINTS.categories}/${id}`, { method: 'PATCH', body: JSON.stringify({ name: newName.trim(), slug: slugify(newName.trim(), { lower: true, strict: true }) }) });
      toast.success('Category updated');
      await fetchCategories();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update category');
    }
  };

  const uploadFile = async (file: File) => {
    if (!file) return;
    setUploadingImage(true);

    const isLocalhost = (url: string) => {
      try {
        return url.includes('localhost') || url.includes('127.0.0.1');
      } catch {
        return false;
      }
    };


    const tryUpload = async (uploadUrl: string) => {
      const fd = new FormData();
      fd.append('file', file);
      try {
        const token = (typeof window !== 'undefined') ? localStorage.getItem('token') : null;
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(uploadUrl, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: fd,
        });
        let json: any = null;
        try { json = await res.json(); } catch {}
        if (!res.ok) throw new Error(json?.message || json?.error || `${res.status} ${res.statusText}`);
        return json;
      } catch (err: any) {
        // wrap network errors so callers can inspect message
        throw new Error(err?.message || String(err));
      }
    };

    try {
      const base = API_BASE || '';
      const baseNormalized = base.endsWith('/') ? base.slice(0, -1) : base;
      const primaryUrl = base ? `${baseNormalized}/api/uploads` : '';

      // If API_BASE points to localhost but frontend isn't on localhost, try relative '/api/uploads' first
      if (base && isLocalhost(base) && !location.hostname.includes('localhost') && !location.hostname.includes('127.0.0.1')) {
        try {
          const relJson = await tryUpload('/api/uploads');
          const url = relJson?.url || relJson?.data?.url;
          const full = url && url.startsWith('http') ? url : (url ? url : '/placeholder.svg');
          setProductForm((p) => ({ ...p, image_url: full }));
          toast.success('Image uploaded (via relative /api fallback)');
          return;
        } catch (relErr) {
          console.warn('Relative upload failed, falling back to API_BASE upload:', relErr?.message || relErr);
        }
      }

      // Try primary API_BASE upload (if configured)
      if (primaryUrl) {
        try {
          const json = await tryUpload(primaryUrl);
          const url = json?.url || json?.data?.url;
          if (url) {
            const full = url.startsWith('http') ? url : `${baseNormalized}${url}`;
            setProductForm((p) => ({ ...p, image_url: full }));
            toast.success('Image uploaded');
            return;
          }
        } catch (primaryErr: any) {
          console.warn('Primary upload failed:', primaryErr?.message || primaryErr);

          // If failure looks like mixed-content (https page -> http API), attempt to retry with page protocol
          try {
            if (primaryUrl.startsWith('http:') && location.protocol === 'https:') {
              const httpsUrl = primaryUrl.replace(/^http:/, 'https:');
              const json2 = await tryUpload(httpsUrl);
              const url2 = json2?.url || json2?.data?.url;
              if (url2) {
                const full = url2.startsWith('http') ? url2 : `${httpsUrl}${url2}`;
                setProductForm((p) => ({ ...p, image_url: full }));
                toast.success('Image uploaded (via https fallback)');
                return;
              }
            }
          } catch (httpsErr: any) {
            console.warn('HTTPS fallback failed:', httpsErr?.message || httpsErr);
          }
        }
      }

      // Last resort: try relative '/api/uploads' (useful when frontend and backend are co-hosted)
      try {
        const relJson2 = await tryUpload('/api/uploads');
        const url = relJson2?.url || relJson2?.data?.url;
        const full = url && url.startsWith('http') ? url : (url ? url : '/placeholder.svg');
        setProductForm((p) => ({ ...p, image_url: full }));
        toast.success('Image uploaded (via relative /api)');
        return;
      } catch (finalRelErr) {
        console.warn('Relative /api upload failed as last resort:', finalRelErr?.message || finalRelErr);
      }

      // No url returned — use placeholder
      setProductForm((p) => ({ ...p, image_url: '/placeholder.svg' }));
      toast.warning('Upload did not return a URL; using placeholder image');
    } catch (err: any) {
      // Final fallback: use placeholder image so the UI remains functional in preview
      setProductForm((p) => ({ ...p, image_url: '/placeholder.svg' }));
      toast.error(err?.message || 'Image upload failed — using placeholder');
      console.warn('uploadFile error:', err);
    } finally {
      setUploadingImage(false);
    }
  };

  const uploadQrCode = async (file: File) => {
    if (!file) return;
    setUploadingQrCode(true);

    const isLocalhost = (url: string) => {
      try {
        return url.includes('localhost') || url.includes('127.0.0.1');
      } catch {
        return false;
      }
    };

    const normalizeForUi = (u: string) => {
      const s = String(u || '');
      if (!s) return '';
      if (s.startsWith('http')) {
        try { const parsed = new URL(s); if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return `/api${parsed.pathname}`; } catch {}
        return s;
      }
      if (s.startsWith('/api/uploads')) return s;
      if (s.startsWith('/uploads')) return `/api${s}`;
      if (s.startsWith('uploads')) return `/api/${s}`;
      return s;
    };

    const tryUpload = async (uploadUrl: string) => {
      const fd = new FormData();
      fd.append('file', file);
      try {
        const token = (typeof window !== 'undefined') ? localStorage.getItem('token') : null;
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(uploadUrl, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: fd,
        });
        let json: any = null;
        try { json = await res.json(); } catch {}
        if (!res.ok) throw new Error(json?.message || json?.error || `${res.status} ${res.statusText}`);
        return json;
      } catch (err: any) {
        throw new Error(err?.message || String(err));
      }
    };

    try {
      const base = API_BASE || '';
      const baseNormalized = base.endsWith('/') ? base.slice(0, -1) : base;
      const primaryUrl = base ? `${baseNormalized}/api/uploads` : '';

      if (base && isLocalhost(base) && !location.hostname.includes('localhost') && !location.hostname.includes('127.0.0.1')) {
        try {
          const relJson = await tryUpload('/api/uploads');
          const url = relJson?.url || relJson?.data?.url;
          const full = normalizeForUi(url);
          setPaymentForm((p) => ({ ...p, upiQrImage: full }));
          toast.success('QR Code uploaded');
          return;
        } catch (relErr) {
          console.warn('Relative upload failed, falling back to API_BASE upload:', relErr?.message || relErr);
        }
      }

      if (primaryUrl) {
        try {
          const json = await tryUpload(primaryUrl);
          const url = json?.url || json?.data?.url;
          if (url) {
            const full = normalizeForUi(url);
            setPaymentForm((p) => ({ ...p, upiQrImage: full }));
            toast.success('QR Code uploaded');
            return;
          }
        } catch (primaryErr: any) {
          console.warn('Primary upload failed:', primaryErr?.message || primaryErr);

          try {
            if (primaryUrl.startsWith('http:') && location.protocol === 'https:') {
              const httpsUrl = primaryUrl.replace(/^http:/, 'https:');
              const json2 = await tryUpload(httpsUrl);
              const url2 = json2?.url || json2?.data?.url;
              if (url2) {
                const full = normalizeForUi(url2);
                setPaymentForm((p) => ({ ...p, upiQrImage: full }));
                toast.success('QR Code uploaded (via https fallback)');
                return;
              }
            }
          } catch (httpsErr: any) {
            console.warn('HTTPS fallback failed:', httpsErr?.message || httpsErr);
          }
        }
      }

      try {
        const relJson2 = await tryUpload('/api/uploads');
        const url = relJson2?.url || relJson2?.data?.url;
        const full = normalizeForUi(url);
        setPaymentForm((p) => ({ ...p, upiQrImage: full }));
        toast.success('QR Code uploaded (via relative /api)');
        return;
      } catch (finalRelErr) {
        console.warn('Relative /api upload failed as last resort:', finalRelErr?.message || finalRelErr);
      }

      toast.error('QR Code upload failed');
    } catch (err: any) {
      toast.error(err?.message || 'QR Code upload failed');
      console.warn('uploadQrCode error:', err);
    } finally {
      setUploadingQrCode(false);
    }
  };

const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const price = Number(productForm.price);
    const stock = Number(productForm.stock);
    if (Number.isNaN(price) || price < 0) {
      toast.error('Price must be a valid non-negative number.');
      return;
    }
    if (Number.isNaN(stock) || stock < 0) {
      toast.error('Stock must be a valid non-negative number.');
      return;
    }

    try {
      setSaving(true);
      const sizeChartData = productForm.sizeChart;
      const sizeChartPayload = sizeChartData && (sizeChartData.title.trim() || sizeChartData.rows?.length > 0 || sizeChartData.guidelines.trim())
        ? {
            title: sizeChartData.title.trim() || undefined,
            rows: Array.isArray(sizeChartData.rows)
              ? sizeChartData.rows.filter(r => r.sizeLabel?.trim())
              : [],
            guidelines: sizeChartData.guidelines.trim() || undefined,
            diagramUrl: sizeChartData.diagramUrl?.trim() || undefined,
          }
        : undefined;

      const payload = {
        name: productForm.name.trim(),
        description: productForm.description.trim(),
        price,
        image_url: productForm.image_url.trim(),
        stock,
        sizes: Array.isArray(productForm.sizes) ? productForm.sizes : [],
        trackInventoryBySize: productForm.trackInventoryBySize,
        sizeInventory: Array.isArray(productForm.sizeInventory) ? productForm.sizeInventory : [],
        sizeChart: sizeChartPayload,
        categoryId: (productForm as any).categoryId || undefined,
        subcategoryId: (productForm as any).subcategoryId || undefined,
        highlights: Array.isArray(productForm.highlights) ? productForm.highlights.filter(h => h.trim()) : [],
        longDescription: productForm.longDescription.trim(),
        specs: Array.isArray(productForm.specs) ? productForm.specs.filter(s => s.key.trim() && s.value.trim()) : [],
      };

      if (editingProduct) {
        await apiFetch(`${ENDPOINTS.products}/${(editingProduct as any).id || (editingProduct as any)._id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        toast.success('Product updated successfully');
      } else {
        await apiFetch(ENDPOINTS.products, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Product added successfully');
      }

      setIsDialogOpen(false);
      resetForm();
      void fetchAdminResources();
    } catch (error: any) {
      toast.error(`Failed to save product: ${error?.message ?? 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (id: string) => {
    const ok = confirm('Delete this product?');
    if (!ok) return;

    try {
      // optimistic update
      setProducts((prev) => prev.filter((p: any) => String(p._id || p.id) !== String(id)));
      await apiFetch(`${ENDPOINTS.products}/${id}`, { method: 'DELETE' });
      toast.success('Product deleted');
      void fetchAdminResources();
    } catch (error: any) {
      toast.error(`Failed to delete product: ${error?.message ?? 'Unknown error'}`);
      // revert on failure
      void fetchAdminResources();
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      await apiFetch(`${ENDPOINTS.orders}/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      toast.success('Order status updated');
      void fetchAdminResources();
    } catch (error: any) {
      toast.error(`Failed to update order: ${error?.message ?? 'Unknown error'}`);
    }
  };

  const generateInvoice = async (orderId: string) => {
    try {
      setGeneratingInvoice((prev) => ({ ...prev, [orderId]: true }));
      const response = await apiFetch<any>('/api/admin/invoices/generate', {
        method: 'POST',
        body: JSON.stringify({ orderId }),
      });
      if (response?.invoiceNo) {
        setOrderInvoices((prev) => ({ ...prev, [orderId]: response.invoiceNo }));
        toast.success('Invoice generated successfully');
      } else {
        toast.error('Failed to generate invoice');
      }
    } catch (error: any) {
      console.error('Generate invoice error:', error);
      toast.error(`Failed to generate invoice: ${error?.message ?? 'Unknown error'}`);
    } finally {
      setGeneratingInvoice((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const viewInvoice = (orderId: string) => {
    navigate(`/admin/orders/${orderId}/invoice`);
  };

  const deleteUser = async (id: string) => {
    const ok = confirm('Delete this user profile?');
    if (!ok) return;

    try {
      await apiFetch(`${ENDPOINTS.users}/${id}`, { method: 'DELETE' });
      toast.success('User deleted');
      void fetchAdminResources();
    } catch (error: any) {
      toast.error(`Failed to delete user: ${error?.message ?? 'Unknown error'}`);
    }
  };

  // Open edit drawer for a user
  const openEditUser = (u: User) => {
    setEditingUser(u);
    setUserForm({
      name: (u as any).name || '',
      email: (u as any).email || '',
      phone: (u as any).phone || '',
      role: (u as any).role || 'user',
      status: (u as any).status || 'active',
      address1: (u as any).address1 || '',
    });
    setUserErrors({});
    setUserDrawerOpen(true);
  };

  const closeUserDrawer = () => {
    setUserDrawerOpen(false);
    setEditingUser(null);
    setUserErrors({});
  };

  const validateUserForm = (form: any) => {
    const errs: Record<string,string> = {};
    if (!form.name || !String(form.name).trim()) errs.name = 'Name is required';
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.email || !emailRe.test(String(form.email))) errs.email = 'Invalid email';
    const phoneRe = /^[0-9\-\s()+]{6,20}$/;
    if (form.phone && !phoneRe.test(String(form.phone))) errs.phone = 'Invalid phone';
    if (!['user','admin'].includes(form.role)) errs.role = 'Invalid role';
    if (!['active','suspended'].includes(form.status)) errs.status = 'Invalid status';
    return errs;
  };

  const saveUser = async () => {
    if (!editingUser) return;
    const errs = validateUserForm(userForm);
    if (Object.keys(errs).length) { setUserErrors(errs); return; }
    try {
      setUserSaving(true);
      const payload: any = {};
      ['name','email','phone','role','status','address1'].forEach((k) => {
        if ((userForm as any)[k] !== (editingUser as any)[k] && (userForm as any)[k] !== undefined) payload[k] = (userForm as any)[k];
      });
      if (Object.keys(payload).length === 0) {
        toast('No changes to save');
        setUserSaving(false);
        setUserDrawerOpen(false);
        return;
      }

      // Try admin users endpoint then fallback
      try {
        await apiFetch(`/api/admin/users/${(editingUser as any)._id || (editingUser as any).id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } catch (e) {
        await apiFetch(`${ENDPOINTS.users}/${(editingUser as any)._id || (editingUser as any).id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      }

      toast.success('User updated');
      setUserDrawerOpen(false);
      // Update local row
      setUsers((prev) => prev.map((u) => ((u as any)._id === (editingUser as any)._id || (u as any).id === (editingUser as any).id) ? { ...u, ...payload } : u));
    } catch (err: any) {
      console.error('Save user error:', err);
      toast.error(err?.message || 'Failed to update user');
    } finally {
      setUserSaving(false);
    }
  };

  // Product selection helpers
  const toggleProductSelection = (id: string) => {
    setSelectedProductIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      setSelectAllOnPage(false);
      setSelectAllResults(false);
      return next;
    });
  };

  const toggleSelectAllOnPage = () => {
    if (!products || products.length === 0) return;
    setSelectedProductIds((s) => {
      const next = new Set(s);
      const ids = products.map((p:any) => (p._id || p.id));
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
        setSelectAllOnPage(false);
      } else {
        ids.forEach((id) => next.add(id));
        setSelectAllOnPage(true);
      }
      setSelectAllResults(false);
      return next;
    });
  };

  const selectAllResultsClick = async () => {
    try {
      // fetch all product ids (large limit) - backend should provide a better endpoint in prod
      const all = await apiFetch<any[]>(`${ENDPOINTS.products}?limit=10000`);
      const ids = Array.isArray(all) ? all.map((p:any)=>p._id||p.id).filter(Boolean) : [];
      setSelectedProductIds(new Set(ids));
      setSelectAllResults(true);
      setSelectAllOnPage(true);
    } catch (err) {
      console.warn('Failed to select all results', err);
      toast.error('Failed to select all results');
    }
  };

  const bulkDeleteProducts = async () => {
    const ids = Array.from(selectedProductIds);
    if (ids.length === 0) return toast.error('No products selected');
    const ok = confirm(`Delete ${ids.length} product(s)? This cannot be undone.`);
    if (!ok) return;
    try {
      // Try bulk-delete endpoint first
      try {
        await apiFetch(`/api/admin/products/bulk-delete`, { method: 'POST', body: JSON.stringify({ ids }) });
      } catch (e) {
        // fallback: delete one by one
        for (const id of ids) {
          try { await apiFetch(`${ENDPOINTS.products}/${id}`, { method: 'DELETE' }); } catch (err) { console.warn('Failed delete', id, err); }
        }
      }
      toast.success(`Deleted ${ids.length} product(s)`);
      setSelectedProductIds(new Set());
      setSelectAllOnPage(false);
      setSelectAllResults(false);
      await fetchAdminResources();
    } catch (err) {
      console.error('Bulk delete error', err);
      toast.error('Failed to delete products');
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSavingPayment(true);
      const updated = await apiFetch<IntegrationSettings>(ENDPOINTS.settings, {
        method: 'PUT',
        body: JSON.stringify({ payment: paymentForm }),
      });
      setSettings(normalizeSettings(updated));
      toast.success('Payment settings updated');
    } catch (error: any) {
      const errorMsg = error?.message ?? 'Unknown error';
      console.error('Payment settings save error:', error);
      toast.error(`Failed to update payment settings: ${errorMsg}`);
    } finally {
      setSavingPayment(false);
    }
  };

  const handleRazorpaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!razorpayForm.keyId.trim()) {
      toast.error('Razorpay Key ID is required');
      return;
    }
    if (!razorpayForm.keySecret.trim()) {
      toast.error('Razorpay Key Secret is required');
      return;
    }

    try {
      setSavingRazorpay(true);
      const updated = await apiFetch<IntegrationSettings>(ENDPOINTS.settings, {
        method: 'PUT',
        body: JSON.stringify({ razorpay: razorpayForm }),
      });
      setSettings(normalizeSettings(updated));
      toast.success('Razorpay settings saved successfully');
    } catch (error: any) {
      const errorMsg = error?.message ?? 'Unknown error';
      console.error('Razorpay settings save error:', error);
      toast.error(`Failed to save Razorpay settings: ${errorMsg}`);
    } finally {
      setSavingRazorpay(false);
    }
  };

  const handleRazorpayTest = async () => {
    if (!razorpayForm.keyId.trim()) {
      toast.error('Razorpay Key ID is required to test connection');
      return;
    }
    if (!razorpayForm.keySecret.trim()) {
      toast.error('Razorpay Key Secret is required to test connection');
      return;
    }

    try {
      setTestingRazorpay(true);
      const result = await apiFetch<{ message: string }>('/api/settings/razorpay/test', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      toast.success(result.message || 'Connection test successful');
    } catch (error: any) {
      const errorMsg = error?.message ?? 'Unknown error';
      console.error('Razorpay test error:', error);
      toast.error(`Connection test failed: ${errorMsg}`);
    } finally {
      setTestingRazorpay(false);
    }
  };

  const handleRazorpayReset = () => {
    setRazorpayForm(createDefaultRazorpaySettings());
    toast.success('Form reset to defaults');
  };

  const handleShiprocketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSavingShiprocket(true);
      const updated = await apiFetch<IntegrationSettings>(ENDPOINTS.settings, {
        method: 'PUT',
        body: JSON.stringify({ shipping: { shiprocket: shiprocketForm } }),
      });
      setSettings(normalizeSettings(updated));
      toast.success('Shiprocket settings updated');
    } catch (error: any) {
      toast.error(`Failed to update Shiprocket settings: ${error?.message ?? 'Unknown error'}`);
    } finally {
      setSavingShiprocket(false);
    }
  };

  const fetchCoupons = async () => {
    try {
      setCouponsLoading(true);
      const data = await apiFetch<any[]>('/api/coupons/admin/list');
      setCoupons(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to fetch coupons:', err);
      toast.error(err?.message || 'Failed to load coupons');
    } finally {
      setCouponsLoading(false);
    }
  };

  const createCoupon = async () => {
    if (!couponForm.code.trim() || couponForm.discount < 1 || couponForm.discount > 100 || !couponForm.expiryDate) {
      toast.error('Fill all fields correctly');
      return;
    }
    try {
      setCouponSaving(true);
      const newCoupon = await apiFetch<any>('/api/coupons/admin/create', {
        method: 'POST',
        body: JSON.stringify({
          code: couponForm.code.trim(),
          discount: couponForm.discount,
          expiryDate: couponForm.expiryDate,
        }),
      });
      setCoupons((prev) => [newCoupon, ...prev]);
      setCouponForm({ code: '', discount: 10, expiryDate: '' });
      setCouponDialogOpen(false);
      toast.success('Coupon created successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create coupon');
    } finally {
      setCouponSaving(false);
    }
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm('Delete this coupon?')) return;
    try {
      await apiFetch<any>(`/api/coupons/admin/${id}`, { method: 'DELETE' });
      setCoupons((prev) => prev.filter((c) => c.id !== id));
      toast.success('Coupon deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete coupon');
    }
  };

  const renderCoupons = () => (







    <div className="space-y-6">
  <div className="flex items-center justify-between">
    <div>
      <h2 className="text-2xl font-bold text-slate-500 dark:text-slate-200">Coupon Management</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Create and manage discount coupons</p>
    </div>

    <Dialog open={couponDialogOpen} onOpenChange={setCouponDialogOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full">
          <Plus className="h-4 w-4 mr-2" />
          Create Coupon
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-slate-100">Create New Coupon</DialogTitle>
          <DialogDescription className="text-slate-600 dark:text-slate-300">
            Add a discount coupon for customers
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="coupon-code" className="text-slate-700 dark:text-slate-200">Coupon Code</Label>
            <Input
              id="coupon-code"
              placeholder="e.g., SAVE10"
              value={couponForm.code}
              onChange={(e) =>
                setCouponForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))
              }
              disabled={couponSaving}
              className="text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          <div>
            <Label htmlFor="coupon-discount" className="text-slate-700 dark:text-slate-200">Discount (%)</Label>
            <Input
              id="coupon-discount"
              type="number"
              min="1"
              max="100"
              value={couponForm.discount}
              onChange={(e) => setCouponForm((p) => ({ ...p, discount: Number(e.target.value) }))}
              disabled={couponSaving}
              className="text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          <div>
            <Label htmlFor="coupon-expiry" className="text-slate-700 dark:text-slate-200">Expiry Date</Label>
            <Input
              id="coupon-expiry"
              type="date"
              value={couponForm.expiryDate}
              onChange={(e) => setCouponForm((p) => ({ ...p, expiryDate: e.target.value }))}
              disabled={couponSaving}
              className="text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setCouponDialogOpen(false)} disabled={couponSaving}>
              Cancel
            </Button>
            <Button onClick={createCoupon} disabled={couponSaving}>
              {couponSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>

  <Card className="shadow-sm rounded-xl bg-white dark:bg-slate-900">
    <CardContent className="p-4">
      <div className="overflow-x-auto text-slate-800 dark:text-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-slate-700 dark:text-slate-300">Coupon Code</TableHead>
              <TableHead className="text-slate-700 dark:text-slate-300">Discount (%)</TableHead>
              <TableHead className="text-slate-700 dark:text-slate-300">Expiry Date</TableHead>
              <TableHead className="text-slate-700 dark:text-slate-300">Used By</TableHead>
              <TableHead className="text-slate-700 dark:text-slate-300">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {couponsLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-slate-600 dark:text-slate-300">
                  Loading...
                </TableCell>
              </TableRow>
            ) : coupons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-slate-600 dark:text-slate-300">
                  No coupons created yet
                </TableCell>
              </TableRow>
            ) : (
              coupons.map((coupon) => (
                <TableRow key={coupon.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium text-sm break-words">{coupon.code}</TableCell>
                  <TableCell className="text-sm">{coupon.discount}%</TableCell>
                  <TableCell className="text-sm">
                    {new Date(coupon.expiryDate).toLocaleDateString("en-IN")}
                  </TableCell>
                  <TableCell className="text-sm">{coupon.usedCount}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteCoupon(coupon.id)}
                      disabled={couponSaving}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </CardContent>
  </Card>
</div>







  );





  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p>Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const renderOverview = () => (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter">Overview</h1>
        <p className="text-muted-foreground mt-2">Sales and users at a glance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-3xl font-bold">₹{Number(overviewData?.totals?.revenue || 0).toLocaleString('en-IN')}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {overviewLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-3xl font-bold">{Number(overviewData?.totals?.orders || 0)}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            {overviewLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-3xl font-bold">{Number(overviewData?.totals?.users || 0)}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Last Month vs Previous</CardTitle>
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : (
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between"><span>Revenue</span><span className="font-semibold">₹{Number(overviewData?.lastMonth?.revenue || 0).toLocaleString('en-IN')} vs ₹{Number(overviewData?.prevMonth?.revenue || 0).toLocaleString('en-IN')}</span></div>
                <div className="flex items-center justify-between"><span>Orders</span><span className="font-semibold">{Number(overviewData?.lastMonth?.orders || 0)} vs {Number(overviewData?.prevMonth?.orders || 0)}</span></div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle>Daily Revenue & Orders</CardTitle>
            {overviewError && <p className="text-xs text-destructive mt-1">{overviewError}</p>}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border overflow-hidden">
              {(['7d','30d','90d'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setOverviewRange(r)}
                  className={cn('px-3 py-1 text-xs', overviewRange === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="flex rounded-md border border-border overflow-hidden">
              {(['line','bar'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setChartType(t)}
                  className={cn('px-3 py-1 text-xs capitalize', chartType === t ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted')}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {overviewLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <ChartContainer
              config={{ revenue: { label: 'Revenue', color: 'hsl(var(--primary))' }, orders: { label: 'Orders', color: 'hsl(var(--muted-foreground))' } }}
              className="w-full aspect-[16/7]"
            >
              {({ width, height }) => (
                chartType === 'line' ? (
                  <LineChart width={width} height={height} data={overviewData?.series || []} margin={{ left: 12, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickMargin={8} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="var(--color-revenue)" dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="orders" stroke="var(--color-orders)" dot={false} />
                  </LineChart>
                ) : (
                  <BarChart width={width} height={height} data={overviewData?.series || []} margin={{ left: 12, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickMargin={8} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar yAxisId="left" dataKey="revenue" fill="var(--color-revenue)" radius={[4,4,0,0]} />
                    <Bar yAxisId="right" dataKey="orders" fill="var(--color-orders)" radius={[4,4,0,0]} />
                  </BarChart>
                )
              )}
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderProducts = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Products</h2>
          <p className="text-sm text-muted-foreground">Add, edit, or remove items from your store.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={selectAllOnPage} onChange={toggleSelectAllOnPage} />
            <span className="text-sm">Select all on page</span>
          </label>
          {selectedProductIds.size > 0 && (
            <div className="flex items-center gap-2">
              <Button variant="destructive" onClick={bulkDeleteProducts}>Bulk Delete ({selectedProductIds.size})</Button>
              {!selectAllResults && (
                <button className="underline text-sm" onClick={(e)=>{ e.preventDefault(); void selectAllResultsClick(); }}>Select all results ({stats.totalProducts || 'N'})</button>
              )}
            </div>
          )}
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
              <DialogDescription>
                {editingProduct ? 'Update product details to keep your catalogue accurate.' : 'Create a new product listing for the UNI10 store.'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleProductSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={productForm.name}
                  onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={productForm.description}
                  onChange={(e) => setProductForm((p) => ({ ...p, description: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Price</Label>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={productForm.price}
                    onChange={(e) => setProductForm((p) => ({ ...p, price: Number(e.target.value) }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="stock">Stock</Label>
                  <Input
                    id="stock"
                    type="number"
                    min={0}
                    value={productForm.stock}
                    onChange={(e) => setProductForm((p) => ({ ...p, stock: Number(e.target.value) }))}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="image_url">Image URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="image_url"
                    value={productForm.image_url}
                    onChange={(e) => setProductForm((p) => ({ ...p, image_url: e.target.value }))}
                    required
                  />
                  <div className="flex items-center gap-2">
                    <input
                      id="image_file"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadFile(f);
                        e.currentTarget.value = '';
                      }}
                    />
                    <Button type="button" onClick={() => document.getElementById('image_file')?.click()} disabled={uploadingImage}>
                      {uploadingImage ? 'Uploading...' : 'Upload'}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={(productForm as any).categoryId}
                    onValueChange={(val) => { setProductForm((p) => ({ ...p, categoryId: val, subcategoryId: '' })); void fetchChildren(val); }}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {topCategories.map((c: any) => (
                        <SelectItem key={(c as any)._id || (c as any).id} value={(c as any)._id || (c as any).id}>
                          {(c as any).name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="subcategory">Subcategory</Label>
                  <Select
                    value={(productForm as any).subcategoryId}
                    onValueChange={(val) => setProductForm((p) => ({ ...p, subcategoryId: val }))}
                    disabled={!(productForm as any).categoryId}
                  >
                    <SelectTrigger id="subcategory">
                      <SelectValue placeholder="Select subcategory" />
                    </SelectTrigger>
                    <SelectContent>
                      {(childrenByParent[(productForm as any).categoryId] || []).map((sc: any) => (
                        <SelectItem key={(sc as any)._id || (sc as any).id} value={(sc as any)._id || (sc as any).id}>
                          {(sc as any).name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Can't find it?{' '}
                <button
                  type="button"
                  className="underline"
                  onClick={() => { setActiveSection('categories'); setIsDialogOpen(false); }}
                >
                  Manage categories
                </button>
              </div>

              <div>
                <Label>Track Inventory by Size</Label>
                <div className="flex items-center gap-3 mt-2">
                  <Switch
                    checked={productForm.trackInventoryBySize}
                    onCheckedChange={(checked) =>
                      setProductForm((p) => ({ ...p, trackInventoryBySize: checked }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {productForm.trackInventoryBySize ? 'Per-size inventory tracking enabled' : 'Use general stock'}
                  </span>
                </div>
              </div>

              {productForm.trackInventoryBySize && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label>Size Inventory</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const defaultSizes = ['S', 'M', 'L', 'XL', 'XXL'];
                          setProductForm((p) => ({
                            ...p,
                            sizeInventory: defaultSizes.map((code) => ({
                              code,
                              label: code,
                              qty: 0,
                            })),
                          }));
                        }}
                      >
                        Add Defaults (S-XXL)
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setProductForm((p) => ({
                            ...p,
                            sizeInventory: p.sizeInventory.map((s) => ({ ...s, qty: 0 })),
                          }));
                        }}
                      >
                        Clear All Qty
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {productForm.sizeInventory.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Click "Add Defaults" to add S/M/L/XL/XXL or manually add sizes below.
                      </p>
                    ) : null}
                    {productForm.sizeInventory.map((sz, idx) => (
                      <div key={idx} className="grid grid-cols-3 gap-2 items-end">
                        <div>
                          <Label className="text-xs text-muted-foreground">Code</Label>
                          <Input
                            value={sz.code}
                            onChange={(e) => {
                              const newSizes = [...productForm.sizeInventory];
                              newSizes[idx].code = e.target.value.toUpperCase();
                              setProductForm((p) => ({ ...p, sizeInventory: newSizes }));
                            }}
                            placeholder="S, M, L..."
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Label</Label>
                          <Input
                            value={sz.label}
                            onChange={(e) => {
                              const newSizes = [...productForm.sizeInventory];
                              newSizes[idx].label = e.target.value;
                              setProductForm((p) => ({ ...p, sizeInventory: newSizes }));
                            }}
                            placeholder="Small..."
                          />
                        </div>
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <Label className="text-xs text-muted-foreground">Qty</Label>
                            <Input
                              type="number"
                              min={0}
                              value={sz.qty}
                              onChange={(e) => {
                                const newSizes = [...productForm.sizeInventory];
                                newSizes[idx].qty = Number(e.target.value) || 0;
                                setProductForm((p) => ({ ...p, sizeInventory: newSizes }));
                              }}
                            />
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setProductForm((p) => ({
                                ...p,
                                sizeInventory: p.sizeInventory.filter((_, i) => i !== idx),
                              }));
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setProductForm((p) => ({
                          ...p,
                          sizeInventory: [...p.sizeInventory, { code: '', label: '', qty: 0 }],
                        }));
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" /> Add Size
                    </Button>
                  </div>
                </div>
              )}

              <div>
                <Label>Sizes (Simple)</Label>
                <div className="flex flex-wrap gap-3 mt-2">
                  {['S','M','L','XL','XXL'].map((sz) => (
                    <label key={sz} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={productForm.sizes.includes(sz)}
                        onCheckedChange={(checked) => {
                          const isOn = Boolean(checked);
                          setProductForm((p) => ({
                            ...p,
                            sizes: isOn ? Array.from(new Set([...(p.sizes || []), sz])) : (p.sizes || []).filter((s) => s !== sz),
                          }));
                        }}
                      />
                      <span>{sz}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold mb-4">Structured Size Chart (Alternative)</h3>

                <div>
                  <Label htmlFor="sizeChartStructuredTitle">Size Chart Title</Label>
                  <Input
                    id="sizeChartStructuredTitle"
                    value={productForm.sizeChart.title ?? ''}
                    onChange={(e) => setProductForm((p) => ({ ...p, sizeChart: { ...p.sizeChart, title: e.target.value } }))}
                    placeholder="e.g., KAJARU Printed Men... Size Chart"
                  />
                </div>

                <div>
                  <Label className="mt-4 block">Size Chart Rows</Label>
                  <div className="space-y-3 mt-2">
                    {[...Array(Math.max(1, (productForm.sizeChart.rows?.length ?? 0) + 1))].map((_, idx) => (
                      <div key={idx} className="grid grid-cols-3 gap-2 items-end">
                        <div>
                          <Label className="text-xs text-muted-foreground">Size Label</Label>
                          <Input
                            value={productForm.sizeChart.rows?.[idx]?.sizeLabel ?? ''}
                            onChange={(e) => {
                              const newRows = [...(productForm.sizeChart.rows ?? [])];
                              if (!newRows[idx]) newRows[idx] = { sizeLabel: '', chest: '', brandSize: '' };
                              newRows[idx].sizeLabel = e.target.value;
                              setProductForm((p) => ({ ...p, sizeChart: { ...p.sizeChart, rows: newRows } }));
                            }}
                            placeholder="e.g., XS, S, M..."
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Chest</Label>
                          <Input
                            value={productForm.sizeChart.rows?.[idx]?.chest ?? ''}
                            onChange={(e) => {
                              const newRows = [...(productForm.sizeChart.rows ?? [])];
                              if (!newRows[idx]) newRows[idx] = { sizeLabel: '', chest: '', brandSize: '' };
                              newRows[idx].chest = e.target.value;
                              setProductForm((p) => ({ ...p, sizeChart: { ...p.sizeChart, rows: newRows } }));
                            }}
                            placeholder="e.g., 30-32 in"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Brand Size</Label>
                          <Input
                            value={productForm.sizeChart.rows?.[idx]?.brandSize ?? ''}
                            onChange={(e) => {
                              const newRows = [...(productForm.sizeChart.rows ?? [])];
                              if (!newRows[idx]) newRows[idx] = { sizeLabel: '', chest: '', brandSize: '' };
                              newRows[idx].brandSize = e.target.value;
                              setProductForm((p) => ({ ...p, sizeChart: { ...p.sizeChart, rows: newRows } }));
                            }}
                            placeholder="e.g., M, L..."
                          />
                        </div>
                        {productForm.sizeChart.rows?.[idx]?.sizeLabel && (
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setProductForm((p) => ({
                                ...p,
                                sizeChart: {
                                  ...p.sizeChart,
                                  rows: p.sizeChart.rows?.filter((_, i) => i !== idx) ?? [],
                                },
                              }));
                            }}
                            className="col-span-3"
                          >
                            Remove Row
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="sizeChartGuidelines">Measurement Guidelines</Label>
                  <Textarea
                    id="sizeChartGuidelines"
                    value={productForm.sizeChart.guidelines ?? ''}
                    onChange={(e) => setProductForm((p) => ({ ...p, sizeChart: { ...p.sizeChart, guidelines: e.target.value } }))}
                    placeholder="How to measure... (e.g., Chest: Measure across the fullest part of the chest)"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="sizeChartDiagramUrl">Measurement Diagram URL (Optional)</Label>
                  <Input
                    id="sizeChartDiagramUrl"
                    value={productForm.sizeChart.diagramUrl ?? ''}
                    onChange={(e) => setProductForm((p) => ({ ...p, sizeChart: { ...p.sizeChart, diagramUrl: e.target.value } }))}
                    placeholder="https://example.com/measurement-diagram.png"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="longDescription">Long Description (Rich Text)</Label>
                <Textarea
                  id="longDescription"
                  value={productForm.longDescription}
                  onChange={(e) => setProductForm((p) => ({ ...p, longDescription: e.target.value }))}
                  placeholder="Detailed product description, benefits, usage instructions..."
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="highlights">Highlights (Max 8 bullet points)</Label>
                <div className="space-y-2 mt-2">
                  {[...Array(Math.max(1, productForm.highlights.length + 1))].map((_, idx) => (
                    idx < 8 && (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          value={productForm.highlights[idx] ?? ''}
                          onChange={(e) => {
                            const newHighlights = [...productForm.highlights];
                            newHighlights[idx] = e.target.value;
                            setProductForm((p) => ({ ...p, highlights: newHighlights }));
                          }}
                          placeholder={`Highlight ${idx + 1}`}
                        />
                        {productForm.highlights[idx] && (
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setProductForm((p) => ({
                                ...p,
                                highlights: p.highlights.filter((_, i) => i !== idx),
                              }));
                            }}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    )
                  ))}
                </div>
              </div>

              <div>
                <Label>Specifications</Label>
                <div className="space-y-3 mt-2">
                  {[...Array(Math.max(1, productForm.specs.length + 1))].map((_, idx) => (
                    <div key={idx} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">Key</Label>
                        <Input
                          value={productForm.specs[idx]?.key ?? ''}
                          onChange={(e) => {
                            const newSpecs = [...productForm.specs];
                            if (!newSpecs[idx]) newSpecs[idx] = { key: '', value: '' };
                            newSpecs[idx].key = e.target.value;
                            setProductForm((p) => ({ ...p, specs: newSpecs }));
                          }}
                          placeholder="e.g., Material"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">Value</Label>
                        <Input
                          value={productForm.specs[idx]?.value ?? ''}
                          onChange={(e) => {
                            const newSpecs = [...productForm.specs];
                            if (!newSpecs[idx]) newSpecs[idx] = { key: '', value: '' };
                            newSpecs[idx].value = e.target.value;
                            setProductForm((p) => ({ ...p, specs: newSpecs }));
                          }}
                          placeholder="e.g., 100% Cotton"
                        />
                      </div>
                      {productForm.specs[idx]?.key && productForm.specs[idx]?.value && (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setProductForm((p) => ({
                              ...p,
                              specs: p.specs.filter((_, i) => i !== idx),
                            }));
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingProduct ? 'Update Product' : 'Add Product'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {fetching ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading products…
        </div>
      ) : (
        <div className="grid gap-4">
          {products.length === 0 && (
            <p className="text-sm text-muted-foreground">No products found.</p>
          )}
          {products.map((product) => (
            <Card key={(product as any)._id || (product as any).id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <input type="checkbox" checked={selectedProductIds.has(((product as any)._id || (product as any).id))} onChange={() => toggleProductSelection(((product as any)._id || (product as any).id))} />
                  <img
                    src={(function(){
                      const url = (product as any).image_url || (product as any).images?.[0] || '/placeholder.svg';
                      const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || '';
                      if (!url) return '/placeholder.svg';
                      if (String(url).startsWith('http')) return url;
                      if (String(url).startsWith('/uploads') || String(url).startsWith('uploads')) {
                        const isLocalBase = (() => { try { return API_BASE.includes('localhost') || API_BASE.includes('127.0.0.1'); } catch { return false; } })();
                        const isHttpsPage = (() => { try { return location.protocol === 'https:'; } catch { return false; } })();
                        if (API_BASE && !(isLocalBase && isHttpsPage)) {
                          const base = API_BASE.endsWith('/') ? API_BASE.slice(0,-1) : API_BASE;
                          return String(url).startsWith('/') ? `${base}${url}` : `${base}/${url}`;
                        } else {
                          return String(url).startsWith('/') ? `/api${url}` : `/api/${url}`;
                        }
                      }
                      return url;
                    })()}
                    alt={(product as any).name || (product as any).title || 'Product'}
                    className="w-16 h-16 object-cover rounded"
                    loading="lazy"
                  />
                  <div>
                    <h3 className="font-semibold">{(product as any).name || (product as any).title}</h3>
                    <p className="text-sm text-muted-foreground">{product.category}</p>
                    <p className="font-bold">₹{Number(product.price ?? 0).toLocaleString('en-IN')}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="outline" onClick={() => startEdit(product as any)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={() =>
                      deleteProduct(((product as any)._id || (product as any).id) as any)
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderCategories = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Categories</h2>
          <p className="text-sm text-muted-foreground">Manage parent and subcategories. These appear in product form.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Category</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={addCategory} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="catName">Name</Label>
              <Input id="catName" value={catName} onChange={(e)=>setCatName(e.target.value)} required />
            </div>
            <div className="md:col-span-1 flex items-end">
              <Button type="submit" disabled={catSaving} className="w-full">
                {catSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Category
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Subcategory</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={addSubcategory} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Parent Category</Label>
              <Select value={selectedParentId} onValueChange={setSelectedParentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select parent" />
                </SelectTrigger>
                <SelectContent>
                  {topCategories.map((p: any) => (
                    <SelectItem key={(p as any)._id || (p as any).id} value={(p as any)._id || (p as any).id}>
                      {(p as any).name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subcategory Name</Label>
              <Input value={subcatName} onChange={(e)=>setSubcatName(e.target.value)} required />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={subcatSaving} className="w-full">
                {subcatSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Subcategory
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {topCategories.length === 0 && (
          <p className="text-sm text-muted-foreground">No categories yet.</p>
        )}
        {topCategories.map((c: any) => {
          const cid = (c as any)._id || (c as any).id;
          const children = childrenByParent[cid] || [];
          return (
            <Card key={cid}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{(c as any).name}</h3>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => editCategoryName(cid, (c as any).name)}>
                      <Edit className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    <Button size="icon" variant="destructive" onClick={() => deleteCategory(cid)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">Subcategories</p>
                    <Button size="sm" variant="ghost" onClick={() => fetchChildren(cid)}>Refresh</Button>
                  </div>
                  {children.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No subcategories</p>
                  ) : (
                    <div className="space-y-2">
                      {children.map((sc: any) => {
                        const sid = (sc as any)._id || (sc as any).id;
                        return (
                          <div key={sid} className="flex items-center justify-between rounded border p-2">
                            <div className="text-sm">{(sc as any).name}</div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => editCategoryName(sid, (sc as any).name)}>
                                <Edit className="h-4 w-4 mr-1" /> Edit
                              </Button>
                              <Button size="icon" variant="destructive" onClick={() => deleteCategory(sid)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );

  const renderOrders = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Orders</h2>
        <p className="text-sm text-muted-foreground">Track customer orders and update their status.</p>
        {orders.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Showing {(ordersCurrentPage - 1) * ordersPerPage + 1} to {Math.min(ordersCurrentPage * ordersPerPage, orders.length)} of {orders.length} orders
          </p>
        )}
      </div>
      {fetching ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading orders…
        </div>
      ) : (
        <>
          <div className="grid gap-4">
            {orders.length === 0 && (
              <p className="text-sm text-muted-foreground">No orders found.</p>
            )}
            {paginatedOrders.map((order: any) => (
            <Card key={order._id || order.id}>
              <CardContent className="p-4 cursor-pointer" onClick={() => openOrderDetail(String(order._id || order.id))}>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <div>
                    <p className="font-semibold">
                      Order #{String((order._id || order.id) ?? '').slice(0, 8)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {(order.created_at || order.createdAt)
                        ? new Date((order.created_at || order.createdAt) as any).toLocaleDateString()
                        : ''}
                    </p>
                    <p className="font-bold mt-2">
                      ₹{Number((order as any).total ?? (order as any).total_amount ?? 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                    {(() => {
                      const orderId = String((order._id || order.id) as any);
                      const hasInvoice = orderInvoices[orderId];
                      const isGenerating = generatingInvoice[orderId];
                      return (
                        <>
                          <Button
                            size="sm"
                            variant={order.status === 'pending' ? 'default' : 'outline'}
                            onClick={() => updateOrderStatus(orderId, 'pending')}
                          >
                            Pending
                          </Button>
                          <Button
                            size="sm"
                            variant={order.status === 'paid' ? 'default' : 'outline'}
                            onClick={() => updateOrderStatus(orderId, 'paid')}
                          >
                            Paid
                          </Button>
                          <Button
                            size="sm"
                            variant={order.status === 'shipped' ? 'default' : 'outline'}
                            onClick={() => updateOrderStatus(orderId, 'shipped')}
                          >
                            Shipped
                          </Button>
                          <Button
                            size="sm"
                            variant={order.status === 'delivered' ? 'default' : 'outline'}
                            onClick={() => updateOrderStatus(orderId, 'delivered')}
                          >
                            Delivered
                          </Button>
                          {order.status === 'paid' && !hasInvoice && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={isGenerating}
                              onClick={() => generateInvoice(orderId)}
                            >
                              {isGenerating ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Generating...
                                </>
                              ) : (
                                'Approve & Generate Invoice'
                              )}
                            </Button>
                          )}
                          {hasInvoice && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewInvoice(orderId)}
                            >
                              View Invoice
                            </Button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
          {orders.length > 0 && (
            <Pagination
              currentPage={ordersCurrentPage}
              totalPages={ordersTotalPages}
              onPageChange={setOrdersCurrentPage}
            />
          )}
        </>
      )}
    </div>
  );

  const renderUsers = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Users</h2>
        <p className="text-sm text-muted-foreground">Review customer accounts and remove inactive users.</p>
      </div>
      {fetching ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading users…
        </div>
      ) : (
        <div className="grid gap-4">
          {users.length === 0 && (
            <p className="text-sm text-muted-foreground">No users found.</p>
          )}
          {users.map((user) => (
            <Card key={(user as any)._id || (user as any).id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <h3 className="font-semibold">{(user as any).name || (user as any).fullName || 'User'}</h3>
                  <p className="text-sm text-muted-foreground">{(user as any).email}</p>
                  {(user as any).phone && (
                    <p className="text-sm text-muted-foreground">{(user as any).phone}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="outline" onClick={() => openEditUser(user)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="destructive" onClick={() => deleteUser((user as any)._id || (user as any).id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderPaymentSettings = () => (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">Payment Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure UPI payment details for your customers. Provide your UPI QR code, UPI ID, and payment instructions.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>UPI Payment Settings</CardTitle>
          <CardDescription>Configure UPI QR code and details for customers to scan and pay.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePaymentSubmit} className="space-y-5">
            <div>
              <Label htmlFor="upiId">UPI ID</Label>
              <Input
                id="upiId"
                placeholder="e.g., yourname@upi"
                value={paymentForm.upiId}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, upiId: e.target.value }))}
                disabled={settingsLoading || savingPayment}
              />
              <p className="text-sm text-muted-foreground mt-1">Your UPI address (e.g., merchant@upi or 9876543210@paytm)</p>
            </div>

            <div>
              <Label htmlFor="beneficiaryName">Beneficiary Name</Label>
              <Input
                id="beneficiaryName"
                placeholder="e.g., Your Business Name"
                value={paymentForm.beneficiaryName}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, beneficiaryName: e.target.value }))}
                disabled={settingsLoading || savingPayment}
              />
              <p className="text-sm text-muted-foreground mt-1">Name that appears to customers during payment</p>
            </div>

            <div>
              <Label htmlFor="instructions">Payment Instructions</Label>
              <Textarea
                id="instructions"
                placeholder="e.g., Scan QR and pay. Enter UTR/Txn ID on next step."
                value={paymentForm.instructions}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, instructions: e.target.value }))}
                rows={3}
                disabled={settingsLoading || savingPayment}
              />
              <p className="text-sm text-muted-foreground mt-1">Instructions shown to customers at checkout</p>
            </div>

            <div className="border-t border-border pt-5">
              <Label className="font-medium mb-3 block">UPI QR Code</Label>
              <p className="text-sm text-muted-foreground mb-4">Upload your UPI QR code image to display during checkout.</p>

              <div className="space-y-3">
                {paymentForm.upiQrImage && (
                  <div className="border border-border rounded p-3 bg-muted">
                    <p className="text-xs text-muted-foreground mb-2">Current QR Code:</p>
                    <img src={paymentForm.upiQrImage} alt="UPI QR Code" className="w-32 h-32 object-contain" />
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    id="qr_file"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadQrCode(f);
                      e.currentTarget.value = '';
                    }}
                    disabled={uploadingQrCode || settingsLoading || savingPayment}
                    className="flex-1"
                  />
                  <Button type="button" disabled={uploadingQrCode || settingsLoading || savingPayment} variant="outline">
                    {uploadingQrCode ? 'Uploading...' : 'Upload QR'}
                  </Button>
                </div>
              </div>
            </div>

            <Button type="submit" disabled={savingPayment || settingsLoading} className="w-full md:w-auto">
              {savingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Payment Settings
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );

  const renderRazorpaySettings = () => (


    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">Razorpay Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure your Razorpay payment gateway credentials. Keys are stored securely on the backend and used for payment processing.
        </p>
      </div>

      <Card className="bg-black rounded-xl shadow-sm p-5">
        <CardHeader>
          <CardTitle>Razorpay Configuration</CardTitle>
          <CardDescription>Add your Razorpay API credentials to enable online payments</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRazorpaySubmit} className="space-y-5">
            <div>
              <Label htmlFor="keyId">Razorpay Key ID</Label>
              <Input
                id="keyId"
                placeholder="e.g., rzp_live_xxxxxxxxxxxxx"
                value={razorpayForm.keyId}
                onChange={(e) => setRazorpayForm((prev) => ({ ...prev, keyId: e.target.value }))}
                disabled={settingsLoading || savingRazorpay || testingRazorpay}
              />
              <p className="text-sm text-muted-foreground mt-1">Your Razorpay public Key ID (from Settings → API Keys)</p>
            </div>

            <div>
              <Label htmlFor="keySecret">Razorpay Key Secret</Label>
              <Input
                id="keySecret"
                type="password"
                placeholder="Enter your key secret"
                value={razorpayForm.keySecret}
                onChange={(e) => setRazorpayForm((prev) => ({ ...prev, keySecret: e.target.value }))}
                disabled={settingsLoading || savingRazorpay || testingRazorpay}
              />
              <p className="text-sm text-muted-foreground mt-1">Your Razorpay secret key (keep this confidential)</p>
            </div>

            <div>
              <Label htmlFor="webhookSecret">Webhook Secret (Optional)</Label>
              <Input
                id="webhookSecret"
                type="password"
                placeholder="Enter webhook secret if configured"
                value={razorpayForm.webhookSecret}
                onChange={(e) => setRazorpayForm((prev) => ({ ...prev, webhookSecret: e.target.value }))}
                disabled={settingsLoading || savingRazorpay || testingRazorpay}
              />
              <p className="text-sm text-muted-foreground mt-1">Optional: For webhook signature verification</p>
            </div>

            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={razorpayForm.currency}
                onValueChange={(value) => setRazorpayForm((prev) => ({ ...prev, currency: value }))}
                disabled={settingsLoading || savingRazorpay || testingRazorpay}
              >
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INR">INR (Indian Rupee)</SelectItem>
                  <SelectItem value="USD">USD (US Dollar)</SelectItem>
                  <SelectItem value="EUR">EUR (Euro)</SelectItem>
                  <SelectItem value="GBP">GBP (British Pound)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">Currency for transactions (default: INR)</p>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="isActive" className="font-medium">
                  Enable Razorpay
                </Label>
                <p className="text-sm text-muted-foreground">Activate to use Razorpay for checkout</p>
              </div>
              <Switch
                id="isActive"
                checked={razorpayForm.isActive}
                onCheckedChange={(checked) => setRazorpayForm((prev) => ({ ...prev, isActive: checked }))}
                disabled={settingsLoading || savingRazorpay || testingRazorpay}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-4">
              <Button
                type="submit"
                disabled={savingRazorpay || settingsLoading || testingRazorpay}
                className="flex-1"
              >
                {savingRazorpay && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Settings
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleRazorpayReset}
                disabled={savingRazorpay || settingsLoading || testingRazorpay}
                className="flex-1"
              >
                Reset
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleRazorpayTest}
                disabled={savingRazorpay || settingsLoading || testingRazorpay || !razorpayForm.keyId.trim() || !razorpayForm.keySecret.trim()}
                className="flex-1"
              >
                {testingRazorpay && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Test Connection
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

     
    </div>


    
  );

  const renderShiprocketSettings = () => (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">Shiprocket Settings</h2>
        <p className="text-sm text-muted-foreground">
          Connect your Shiprocket account to automate fulfilment. These defaults use Shiprocket sandbox credentials so you can test immediately.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shiprocket</CardTitle>
          <CardDescription>Manage delivery configuration and default channel.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleShiprocketSubmit} className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="shiprocketEnabled" className="font-medium">
                  Shiprocket Integration
                </Label>
                <p className="text-sm text-muted-foreground">Enable automated shipping labels and tracking.</p>
              </div>
              <Switch
                id="shiprocketEnabled"
                checked={shiprocketForm.enabled}
                onCheckedChange={(checked) => setShiprocketForm((prev) => ({ ...prev, enabled: checked }))}
                disabled={settingsLoading || savingShiprocket}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="shiprocketEmail">Account Email</Label>
                <Input
                  id="shiprocketEmail"
                  type="email"
                  value={shiprocketForm.email}
                  onChange={(e) => setShiprocketForm((prev) => ({ ...prev, email: e.target.value }))}
                  disabled={settingsLoading || savingShiprocket}
                  required
                />
              </div>
              <div>
                <Label htmlFor="shiprocketPassword">Password</Label>
                <Input
                  id="shiprocketPassword"
                  type="password"
                  value={shiprocketForm.password}
                  onChange={(e) => setShiprocketForm((prev) => ({ ...prev, password: e.target.value }))}
                  disabled={settingsLoading || savingShiprocket}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="shiprocketApiKey">API Key</Label>
                <Input
                  id="shiprocketApiKey"
                  value={shiprocketForm.apiKey}
                  onChange={(e) => setShiprocketForm((prev) => ({ ...prev, apiKey: e.target.value }))}
                  disabled={settingsLoading || savingShiprocket}
                  required
                />
              </div>
              <div>
                <Label htmlFor="shiprocketSecret">Secret</Label>
                <Input
                  id="shiprocketSecret"
                  value={shiprocketForm.secret}
                  onChange={(e) => setShiprocketForm((prev) => ({ ...prev, secret: e.target.value }))}
                  disabled={settingsLoading || savingShiprocket}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="shiprocketChannelId">Channel ID</Label>
              <Input
                id="shiprocketChannelId"
                value={shiprocketForm.channelId}
                onChange={(e) => setShiprocketForm((prev) => ({ ...prev, channelId: e.target.value }))}
                disabled={settingsLoading || savingShiprocket}
                required
              />
            </div>

            <Button type="submit" disabled={savingShiprocket || settingsLoading} className="w-full md:w-auto">
              {savingShiprocket && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Shiprocket Settings
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );

  const renderContactSettings = () => (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">Contact Settings</h2>
        <p className="text-sm text-muted-foreground">Manage public contact information shown on the Contact page and footer.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
          <CardDescription>Phones, emails and address displayed publicly.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label className="font-medium">Phones</Label>
              <div className="space-y-2 mt-2">
                {contactForm.phones.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input value={p} onChange={(e)=>setContactForm((prev)=>({ ...prev, phones: prev.phones.map((x,i)=> i===idx? e.target.value : x) }))} />
                    <Button variant="outline" onClick={() => setContactForm((prev)=>({ ...prev, phones: prev.phones.filter((_,i)=>i!==idx) }))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button onClick={() => setContactForm((prev)=>({ ...prev, phones: [...prev.phones, ''] }))} variant="outline">
                  <Plus className="h-4 w-4 mr-2" /> Add Phone
                </Button>
              </div>
            </div>

            <div>
              <Label className="font-medium">Emails</Label>
              <div className="space-y-2 mt-2">
                {contactForm.emails.map((eAddr, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input value={eAddr} onChange={(e)=>setContactForm((prev)=>({ ...prev, emails: prev.emails.map((x,i)=> i===idx? e.target.value : x) }))} />
                    <Button variant="outline" onClick={() => setContactForm((prev)=>({ ...prev, emails: prev.emails.filter((_,i)=>i!==idx) }))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button onClick={() => setContactForm((prev)=>({ ...prev, emails: [...prev.emails, ''] }))} variant="outline">
                  <Plus className="h-4 w-4 mr-2" /> Add Email
                </Button>
              </div>
            </div>

            <div>
              <Label className="font-medium">Address</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                <div>
                  <Label>Line 1</Label>
                  <Input value={contactForm.address.line1 || ''} onChange={(e)=>setContactForm((prev)=>({ ...prev, address: { ...prev.address, line1: e.target.value } }))} />
                </div>
                <div>
                  <Label>Line 2</Label>
                  <Input value={contactForm.address.line2 || ''} onChange={(e)=>setContactForm((prev)=>({ ...prev, address: { ...prev.address, line2: e.target.value } }))} />
                </div>
                <div>
                  <Label>City</Label>
                  <Input value={contactForm.address.city || ''} onChange={(e)=>setContactForm((prev)=>({ ...prev, address: { ...prev.address, city: e.target.value } }))} />
                </div>
                <div>
                  <Label>State</Label>
                  <Input value={contactForm.address.state || ''} onChange={(e)=>setContactForm((prev)=>({ ...prev, address: { ...prev.address, state: e.target.value } }))} />
                </div>
                <div className="md:col-span-2">
                  <Label>Pincode</Label>
                  <Input value={contactForm.address.pincode || ''} onChange={(e)=>setContactForm((prev)=>({ ...prev, address: { ...prev.address, pincode: e.target.value } }))} />
                </div>
                <div className="md:col-span-2">
                  <Label>Maps URL (optional)</Label>
                  <Input value={contactForm.mapsUrl || ''} onChange={(e)=>setContactForm((prev)=>({ ...prev, mapsUrl: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={saveContactSettings} disabled={contactSaving || contactLoading}>
                {contactSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Contact Settings
              </Button>
              <Button variant="outline" onClick={() => void fetchContactSettings()}>Reload</Button>
            </div>

            {contactLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderBillingSettings = () => (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">Company Billing Details</h2>
        <p className="text-sm text-muted-foreground">Manage company billing information displayed on invoices.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Billing Information</CardTitle>
          <CardDescription>Company details for invoice generation.</CardDescription>
        </CardHeader>
        <CardContent>
          {billingLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void saveBillingInfo();
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={billingForm.companyName}
                  onChange={(e) => setBillingForm((prev) => ({ ...prev, companyName: e.target.value }))}
                  placeholder="e.g., UNI10"
                  disabled={billingSaving}
                  required
                />
              </div>

              <div>
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={billingForm.address}
                  onChange={(e) => setBillingForm((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="e.g., 123 Business St, City, State"
                  disabled={billingSaving}
                  required
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="contactNumber">Contact Number</Label>
                <Input
                  id="contactNumber"
                  value={billingForm.contactNumber}
                  onChange={(e) => setBillingForm((prev) => ({ ...prev, contactNumber: e.target.value }))}
                  placeholder="e.g., +91 9999999999"
                  disabled={billingSaving}
                  required
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={billingForm.email}
                  onChange={(e) => setBillingForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="e.g., billing@company.com"
                  disabled={billingSaving}
                  required
                />
              </div>

              <div>
                <Label htmlFor="gstinNumber">GSTIN Number</Label>
                <Input
                  id="gstinNumber"
                  value={billingForm.gstinNumber}
                  onChange={(e) => setBillingForm((prev) => ({ ...prev, gstinNumber: e.target.value }))}
                  placeholder="e.g., 27AAPAU1234G1Z5"
                  disabled={billingSaving}
                  required
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={billingSaving || billingLoading} className="flex-1 md:flex-none">
                  {billingSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {billingSaving ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void fetchBillingInfo()}
                  disabled={billingSaving || billingLoading}
                >
                  Reset
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderHomeSettings = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Home Ticker & New Arrivals</CardTitle>
          <CardDescription>Manage the ticker lines shown on Home and the number of items in New Arrivals.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label>New Arrivals Limit</Label>
            <Input type="number" min={1} max={100} value={homeLimit} onChange={(e)=>setHomeLimit(Math.max(1, Math.min(100, Number(e.target.value||0))))} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Ticker Lines</Label>
              <Button size="sm" variant="outline" onClick={()=>setHomeTicker((arr)=>[...arr, { id: `tmp_${Date.now()}`, text: '', url: '', startAt: '', endAt: '', priority: 0 }])}>Add Line</Button>
            </div>
            <div className="space-y-3">
              {homeTicker.length === 0 && <p className="text-sm text-muted-foreground">No lines yet.</p>}
              {homeTicker.map((it, idx) => (
                <div key={it.id || idx} className="flex items-end gap-2 border rounded-md p-2">
                  <div className="flex-1">
                    <Label>Text</Label>
                    <Input value={it.text} onChange={(e)=>setHomeTicker((arr)=>{ const copy=[...arr]; copy[idx]={...copy[idx], text: e.target.value}; return copy; })} />
                  </div>
                  <Button variant="destructive" size="sm" onClick={()=>setHomeTicker((arr)=>arr.filter((_,i)=>i!==idx))}>Delete</Button>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Feature Rows (T-SHIRTS, DENIMS, HOODIES)</Label>
              <Button size="sm" variant="outline" onClick={()=>setHomeFeatureRows((arr)=>[...arr, { key: '', title: '', link: '', imageAlt: '' }])}>Add Row</Button>
            </div>
            <p className="text-sm text-muted-foreground">Manage the large category sections on the home page.</p>
            <div className="space-y-3">
              {homeFeatureRows.length === 0 && <p className="text-sm text-muted-foreground">No feature rows yet.</p>}
              {homeFeatureRows.map((row, idx) => (
                <div key={idx} className="border rounded-md p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Key (e.g., tshirts)</Label>
                      <Input value={row.key} onChange={(e)=>setHomeFeatureRows((arr)=>{ const copy=[...arr]; copy[idx]={...copy[idx], key: e.target.value}; return copy; })} placeholder="tshirts" />
                    </div>
                    <div>
                      <Label className="text-xs">Title (e.g., T-SHIRTS)</Label>
                      <Input value={row.title} onChange={(e)=>setHomeFeatureRows((arr)=>{ const copy=[...arr]; copy[idx]={...copy[idx], title: e.target.value}; return copy; })} placeholder="T-SHIRTS" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Link (e.g., /collection/t-shirts)</Label>
                    <Input value={row.link} onChange={(e)=>setHomeFeatureRows((arr)=>{ const copy=[...arr]; copy[idx]={...copy[idx], link: e.target.value}; return copy; })} placeholder="/collection/t-shirts" />
                  </div>
                  <div>
                    <Label className="text-xs">Image Alt Text (optional)</Label>
                    <Input value={row.imageAlt || ''} onChange={(e)=>setHomeFeatureRows((arr)=>{ const copy=[...arr]; copy[idx]={...copy[idx], imageAlt: e.target.value}; return copy; })} placeholder="T-Shirts Collection" />
                  </div>
                  <div className="flex justify-end">
                    <Button variant="destructive" size="sm" onClick={()=>setHomeFeatureRows((arr)=>arr.filter((_,i)=>i!==idx))}>Delete Row</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={saveHomeSettings} disabled={homeSaving || homeLoading}>
              {homeSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Home Settings
            </Button>
            <Button variant="outline" onClick={() => void fetchHomeSettings()}>Reload</Button>
          </div>
          {homeLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        </CardContent>
      </Card>
    </div>
  );

  const fetchAdminReviews = async () => {
    try {
      setReviewsLoading(true);
      const data = await apiFetch<AdminReview[]>(`/api/reviews/admin/reviews?limit=200&v=${Date.now()}`);
      const arr = Array.isArray(data) ? data : (Array.isArray((data as any)?.data) ? (data as any).data : []);
      setReviews(arr);
    } catch (e:any) {
      console.warn('Failed to load reviews', e?.message || e);
    } finally {
      setReviewsLoading(false);
    }
  };


  const openReply = (rev: AdminReview) => {
    setActiveReview(rev);
    setReplyText('');
    setReplyOpen(true);
  };

  const sendReviewReply = async () => {
    if (!activeReview || !replyText.trim()) {
      toast.error('Please write a reply');
      return;
    }
    try {
      const updated = await apiFetch<AdminReview>(`/api/admin/reviews/reply`, {
        method: 'POST',
        body: JSON.stringify({ reviewId: activeReview._id, text: replyText.trim() }),
      });
      setReviews((prev) => prev.map((r) => (r._id === activeReview._id ? (updated as any) : r)));
      setReplyOpen(false);
      toast.success('Reply sent');
    } catch (e:any) {
      toast.error(e?.message || 'Failed to send reply');
    }
  };

  const deleteReview = async (id: string) => {
    if (!confirm('Delete this review?')) return;
    try {
      await apiFetch(`/api/reviews/${id}`, { method: 'DELETE' });
      setReviews((prev) => prev.filter((r) => r._id !== id));
      toast.success('Review deleted');
    } catch (e:any) {
      toast.error(e?.message || 'Failed to delete');
    }
  };





  const renderReviews = () => (






   <div className="space-y-6">
  <div>
    <h2 className="text-2xl font-bold">User Reviews</h2>
  </div>

  <Card className="shadow-sm rounded-xl bg-white dark:bg-slate-900">
    <CardContent className="p-4">
      <div className="overflow-x-auto text-slate-800 dark:text-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-slate-700 dark:text-slate-300">User Name</TableHead>
              <TableHead className="text-slate-700 dark:text-slate-300">Email</TableHead>
              <TableHead className="text-slate-700 dark:text-slate-300">Review</TableHead>
              <TableHead className="text-slate-700 dark:text-slate-300">Rating</TableHead>
              <TableHead className="text-slate-700 dark:text-slate-300">Date</TableHead>
              <TableHead className="text-slate-700 dark:text-slate-300">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {reviews.map((r) => (
              <TableRow key={r._id} className="hover:bg-muted/50">
                <TableCell className="font-medium">{r.userId?.name || "-"}</TableCell>

                {/* stronger color than 'muted' so it stays readable */}
                <TableCell className="text-slate-600 dark:text-slate-300">
                  {r.userId?.email || "-"}
                </TableCell>

                <TableCell className="max-w-[420px]">
                  <div className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                    {r.text}
                  </div>

                  {Array.isArray(r.replies) && r.replies.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {r.replies.map((rep, i) => (
                        <div
                          key={i}
                          className="text-xs text-slate-600 dark:text-slate-300 border-l border-slate-200 dark:border-slate-700 pl-2"
                        >
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {rep.authorId?.name || "Admin"}:
                          </span>{" "}
                          {rep.text}
                        </div>
                      ))}
                    </div>
                  )}
                </TableCell>

                <TableCell>{r.rating ?? "-"}</TableCell>

                <TableCell>
                  {r?.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN") : "-"}
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => openReply(r)}>
                      Reply
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteReview(r._id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {(!reviews || reviews.length === 0) && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-sm text-slate-600 dark:text-slate-300 py-6"
                >
                  {reviewsLoading ? "Loading..." : "No reviews found."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </CardContent>
  </Card>

  <Dialog open={replyOpen} onOpenChange={setReplyOpen}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Reply to Review</DialogTitle>
        <DialogDescription className="text-slate-600 dark:text-slate-300">
          Send a response to the user. This will appear under their review.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label>Reply</Label>
        <Textarea
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Write your reply..."
          className="min-h-[120px] text-slate-800 dark:text-slate-200"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setReplyOpen(false)}>
          Cancel
        </Button>
        <Button onClick={sendReviewReply}>Send Reply</Button>
      </div>
    </DialogContent>
  </Dialog>
</div>

  );












  const renderNotifications = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Send Notifications</h2>
        <p className="text-sm text-muted-foreground">Select users and send an email message.</p>
      </div>
      <Card className="shadow-sm">
        <CardContent className="p-5 space-y-4">
          <Input
            placeholder="Search users..."
            value={notifySearch}
            onChange={(e) => setNotifySearch(e.target.value)}
          />

          <div className="border border-border rounded-lg bg-muted/30">
            <ScrollArea className="h-80">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={allNotifySelected}
                          onCheckedChange={(v) => toggleNotifySelectAll(Boolean(v))}
                          aria-label="Select All"
                        />
                      </div>
                    </TableHead>
                    <TableHead>User Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Joined Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNotifyUsers.map((u) => {
                    const id = String((u as any)._id || (u as any).id || '');
                    const isChecked = notifySelectedIds.has(id);
                    const joinedAt = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : '-';
                    return (
                      <TableRow key={id} className="hover:bg-muted/50">
                        <TableCell className="w-10">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(v) => toggleNotifyUser(id, Boolean(v))}
                            aria-label={`Select ${u.name}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{u.name || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{u.email || '-'}</TableCell>
                        <TableCell>{joinedAt}</TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredNotifyUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                        No users found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notify-message">Message to send</Label>
            <Textarea
              id="notify-message"
              placeholder="Write your message..."
              value={notifyMessage}
              onChange={(e) => setNotifyMessage(e.target.value)}
              className="min-h-[120px]"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {notifySelectedIds.size} selected
            </div>
            <Button
              onClick={sendNotifications}
              disabled={notifySending || notifySelectedIds.size === 0 || !notifyMessage.trim()}
              className="rounded-full transition-all hover:shadow-md"
            >
              {notifySending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send Email
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return renderOverview();
      case 'products':
        return renderProducts();
      case 'categories':
        return renderCategories();
      case 'coupons':
        return renderCoupons();
      case 'pages':
        return <AdminPages />;
      case 'orders':
        return renderOrders();
      case 'users':
        return renderUsers();
      case 'reviews':
        return renderReviews();
      case 'notifications':
        return renderNotifications();
      case 'support':
        return null;
      case 'contact':
        return renderContactSettings();
      case 'billing':
        return renderBillingSettings();
      case 'payment':
        return renderPaymentSettings();
      case 'razorpaySettings':
        return renderRazorpaySettings();
      case 'shiprocket':
        return renderShiprocketSettings();
      case 'home':
        return renderHomeSettings();
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-3 sm:px-4 pt-24 pb-12">
        {/* Mobile sidebar toggle button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="md:hidden mb-4 p-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors flex items-center gap-2"
        >
          {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          <span className="text-sm font-medium">
            {isSidebarOpen ? 'Close' : 'Menu'}
          </span>
        </button>

        <div className="flex flex-col md:flex-row gap-4 md:gap-8">
          {/* Sidebar - Hidden on mobile, shown with toggle or visible on md+ */}
          <aside
            className={cn(
              'transition-all duration-300 ease-in-out',
              'w-full md:w-64',
              isSidebarOpen ? 'block' : 'hidden md:block'
            )}
          >
            <div className="bg-card border border-border rounded-lg p-3 sm:p-4 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Admin Navigation</span>
              </div>
              <div className="mt-4 space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveSection(item.id);
                        setIsSidebarOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {item.id === 'orders' && pendingOrdersCount > 0 && (
                        <Badge variant={isActive ? 'secondary' : 'outline'} className="ml-auto text-xs">
                          {pendingOrdersCount > 99 ? '99+' : pendingOrdersCount}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <section className="flex-1 min-w-0 space-y-4 sm:space-y-6">
            {renderContent()}
          </section>
        </div>
      </main>

      {/* Order Detail Drawer */}
      <Drawer open={orderDrawerOpen} onOpenChange={(o) => { setOrderDrawerOpen(o); if (!o) { setOrderDetail(null); setOrderDetailError(null); } }}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Order #{selectedOrderId ? selectedOrderId.slice(0, 8) : ''}</DrawerTitle>
            {orderDetail?.createdAt && (
              <DrawerDescription>
                {new Date(orderDetail.createdAt).toLocaleString()}
              </DrawerDescription>
            )}
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-4">
            {orderDetailLoading && (
              <div className="space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-24 w-full" />
              </div>
            )}
            {orderDetailError && (
              <p className="text-xs text-destructive">{orderDetailError}</p>
            )}
            {orderDetail && !orderDetailLoading && (
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{orderDetail.status}</Badge>
                  <Badge variant="secondary" className="capitalize">{orderDetail.paymentMethod}</Badge>
                  <div className="ml-auto font-semibold">₹{Number(orderDetail.totals?.total || 0).toLocaleString('en-IN')}</div>
                </div>

                <div className="border rounded-md p-3">
                  <h4 className="font-semibold mb-2">Shipping</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Name:</span> {orderDetail.shipping?.name || '-'}</div>
                    <div><span className="text-muted-foreground">Phone:</span> {orderDetail.shipping?.phone || '-'}</div>
                    <div className="md:col-span-2"><span className="text-muted-foreground">Address 1:</span> {orderDetail.shipping?.address1 || '-'}</div>
                    {orderDetail.shipping?.address2 && (
                      <div className="md:col-span-2"><span className="text-muted-foreground">Address 2:</span> {orderDetail.shipping?.address2}</div>
                    )}
                    <div><span className="text-muted-foreground">City:</span> {orderDetail.shipping?.city || '-'}</div>
                    <div><span className="text-muted-foreground">State:</span> {orderDetail.shipping?.state || '-'}</div>
                    <div><span className="text-muted-foreground">Pincode:</span> {orderDetail.shipping?.pincode || '-'}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold">Items</h4>
                  <div className="space-y-2">
                    {(orderDetail.items || []).map((it: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-3 border rounded-md p-2">
                        <img
                          src={(it.image && String(it.image).length > 3) ? it.image : '/placeholder.svg'}
                          alt={it.title || 'Product'}
                          className="w-12 h-12 object-cover rounded"
                        />
                        <div className="flex-1">
                          <div className="font-medium">{it.title}</div>
                          <div className="text-xs text-muted-foreground">{it.variant?.size ? `Size: ${it.variant.size}` : ''}</div>
                        </div>
                        <div className="text-sm tabular-nums">{it.qty} × ���₹{Number(it.price || 0).toLocaleString('en-IN')}</div>
                        <div className="w-20 text-right font-semibold">₹{(Number(it.qty || 0) * Number(it.price || 0)).toLocaleString('en-IN')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* User Edit Drawer */}
      <Drawer open={userDrawerOpen} onOpenChange={(o) => { setUserDrawerOpen(o); if (!o) setEditingUser(null); }}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{editingUser ? `Edit ${editingUser.name || 'User'}` : 'Edit User'}</DrawerTitle>
            <DrawerDescription>Update user details and permissions.</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={userForm.name} onChange={(e) => setUserForm((p:any)=>({ ...p, name: e.target.value }))} />
              {userErrors.name && <p className="text-xs text-destructive mt-1">{userErrors.name}</p>}
            </div>
            <div>
              <Label>Email</Label>
              <Input value={userForm.email} onChange={(e) => setUserForm((p:any)=>({ ...p, email: e.target.value }))} />
              {userErrors.email && <p className="text-xs text-destructive mt-1">{userErrors.email}</p>}
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={userForm.phone} onChange={(e) => setUserForm((p:any)=>({ ...p, phone: e.target.value }))} />
              {userErrors.phone && <p className="text-xs text-destructive mt-1">{userErrors.phone}</p>}
            </div>
            <div>
              <Label>Role</Label>
              <Select value={userForm.role} onValueChange={(v:any)=>setUserForm((p:any)=>({ ...p, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={userForm.status} onValueChange={(v:any)=>setUserForm((p:any)=>({ ...p, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Address</Label>
              <Textarea value={userForm.address1} onChange={(e)=>setUserForm((p:any)=>({ ...p, address1: e.target.value }))} />
            </div>

            <div className="flex gap-2">
              <Button onClick={saveUser} disabled={userSaving}>
                {userSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Save
              </Button>
              <Button variant="outline" onClick={closeUserDrawer}>Cancel</Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <Footer />
    </div>
  );
};

export default Admin;
