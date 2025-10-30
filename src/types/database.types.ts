export interface OrderItem {
  id: string;
  title: string;
  price: number;
  qty: number;
  image: string;
  variant?: Record<string, any>;
}

export interface Order {
  _id?: string;
  id?: string;
  userId?: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  paymentMethod: 'COD' | 'UPI';
  items: OrderItem[];
  subtotal?: number;
  discount?: number;
  shipping?: number;
  tax?: number;
  total: number;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'returned' | 'cancelled';
  invoiceId?: string;
  upi?: {
    payerName?: string;
    txnId?: string;
  };
  createdAt?: string;
  updatedAt?: string;
  created_at?: string;
}

export interface User {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  phone?: string;
  role: 'user' | 'admin';
  status?: 'active' | 'suspended';
  address1?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Product {
  _id?: string;
  id?: string;
  name: string;
  title?: string;
  price: number;
  category: string;
  image: string;
  stock?: number;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Invoice {
  _id?: string;
  id?: string;
  orderId: string;
  invoiceNo: string;
  issuedAt: string;
  dueAt?: string;
  status: 'draft' | 'issued' | 'paid' | 'cancelled';
  createdAt?: string;
  updatedAt?: string;
}

export interface BusinessInfo {
  name: string;
  logo: string;
  address: string;
  phone: string;
  email: string;
  gstIn: string;
}
