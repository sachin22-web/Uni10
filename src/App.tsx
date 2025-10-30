import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import "@/styles/inputs.css";
import Index from "./pages/Index";
import Shop from "./pages/Shop";
import NewArrivals from "./pages/NewArrivals";
import CollectionDetail from "./pages/CollectionDetail";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import Products from "./pages/Products";
import Wishlist from "./pages/Wishlist";
import Dashboard from "./pages/Dashboard";
import HelpCenter from "./pages/HelpCenter";
    import Contact from "./pages/Contact";
    import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import SupportCenter from "./pages/SupportCenter";
import NewTicket from "./pages/NewTicket";
import SupportTickets from "./pages/SupportTickets";
import AccountShipments from "./pages/AccountShipments";
import AccountProfile from "./pages/AccountProfile";
import { InvoicePage } from "./pages/InvoicePage";
import NotFound from "./pages/NotFound";
import CheckoutPayment from "./pages/CheckoutPayment";
import PageDetail from "./pages/PageDetail";
import MyOrders from "./pages/MyOrders";
import AdminReturns from "./pages/AdminReturns";
import OrderSuccess from "./pages/OrderSuccess";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {/* CartProvider provides cart state and helpers across the app */}
        <CartProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/shop/new-arrivals" element={<NewArrivals />} />
              <Route path="/products" element={<Products />} />
              <Route path="/collection/:slug" element={<CollectionDetail />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<CheckoutPayment />} />
              <Route path="/orders/success" element={<OrderSuccess />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/help-center" element={<HelpCenter />} />
              <Route path="/support" element={<SupportTickets />} />
              <Route path="/support/new" element={<NewTicket />} />
              <Route path="/account/support" element={<SupportTickets />} />
              <Route path="/account/support/new" element={<NewTicket />} />
              <Route path="/account/shipments" element={<AccountShipments />} />
              <Route path="/account/profile" element={<AccountProfile />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/support" element={<SupportCenter />} />
              <Route path="/admin/returns" element={<AdminReturns />} />
              <Route path="/admin/orders/:id/invoice" element={<InvoicePage />} />
              <Route path="/account/orders/:id/invoice" element={<InvoicePage />} />
              <Route path="/my-orders" element={<MyOrders />} />
              <Route path="/page/:slug" element={<PageDetail />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="/contact" element={<Contact />} />
              <Route path="/shipping" element={<HelpCenter />} />
              <Route path="/returns" element={<HelpCenter />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
