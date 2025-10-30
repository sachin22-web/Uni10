import { Link } from "react-router-dom";
import { Instagram, Twitter, Facebook, Mail, Phone, MapPin } from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

type Page = {
  id: string;
  slug: string;
  name: string;
  status: 'active' | 'inactive';
};

export const Footer = () => {
  const currentYear = new Date().getFullYear();
  const [pages, setPages] = useState<Page[]>([]);

  useEffect(() => {
    const fetchPages = async () => {
      try {
        const res = await api('/api/admin/pages/list');
        if (res.ok && res.json?.data) {
          const activePages = (res.json.data as Page[]).filter(p => p.status === 'active');
          setPages(activePages);
        }
      } catch (err) {
        console.error('Failed to fetch pages for footer:', err);
      }
    };

    fetchPages();
  }, []);

  return (
    <footer className="bg-background border-t border-border">
      <div className="container mx-auto px-4 py-16 md:py-20">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand Section */}
          <div className="lg:col-span-2">
            <h3 className="text-2xl font-black tracking-tighter mb-4">
              uni<span className="text-primary">10</span>
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-xs">
              Premium streetwear and lifestyle products for those who dare to be different. Define your universe with uni10.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Mail className="h-4 w-4 text-primary" />
                <a href="mailto:support@uni10.com">support@uni10.com</a>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Phone className="h-4 w-4 text-primary" />
                <a href="tel:+919971541140">+91 99715 41140</a>
              </div>
              <div className="flex items-start gap-3 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>India</span>
              </div>
            </div>
          </div>

          {/* Shop Links */}
          <div>
            <h4 className="font-semibold text-foreground mb-5">Shop</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/shop" className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium">
                  All Products
                </Link>
              </li>
              <li>
                <Link to="/shop/new-arrivals" className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium">
                  New Arrivals
                </Link>
              </li>
              <li>
                <Link to="/products" className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium">
                  Collections
                </Link>
              </li>
              <li>
                <Link to="/wishlist" className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium">
                  Wishlist
                </Link>
              </li>
            </ul>
          </div>

          {/* Support & Info */}
          <div>
            <h4 className="font-semibold text-foreground mb-5">Support</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/contact" className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium">
                  Contact Us
                </Link>
              </li>
              {pages.map((page) => (
                <li key={page.id}>
                  <Link to={`/page/${page.slug}`} className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium">
                    {page.name}
                  </Link>
                </li>
              ))}
              <li>
                <a href="#shipping" className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium">
                  Shipping Info
                </a>
              </li>
              <li>
                <a href="#returns" className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium">
                  Returns & Exchanges
                </a>
              </li>
              <li>
                <a href="#faq" className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4 className="font-semibold text-foreground mb-5">Follow Us</h4>
            <p className="text-sm text-muted-foreground mb-4">Stay updated with our latest collections and news.</p>
            <div className="flex gap-4">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-200"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-200"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-200"
              >
                <Facebook className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border my-12"></div>

        {/* Bottom Footer */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-sm text-muted-foreground">
            &copy; {currentYear} <span className="font-semibold">uni10</span>. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="#privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Privacy Policy
            </a>
            <a href="#terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Terms of Service
            </a>
            <a href="#cookies" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cookie Policy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
