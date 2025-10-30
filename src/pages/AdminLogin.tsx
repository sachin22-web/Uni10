import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const AdminLogin = () => {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && user.role === 'admin') {
      navigate('/admin', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        throw new Error(error?.message || JSON.stringify(error));
      }
      // After sign in, check role via /api/auth/me (AuthContext.refresh will run). Small delay to allow refresh
      setTimeout(async () => {
        try {
          // If user not admin, notify and redirect to dashboard
          // Accessing latest user from localStorage token via parse in AuthContext fallback
          const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
          if (!token) {
            toast.error('Login failed');
            setLoading(false);
            return;
          }
          // decode JWT payload lightly
          const payload = (() => {
            try {
              const p = token.split('.')[1];
              return JSON.parse(decodeURIComponent(atob(p.replace(/-/g, '+').replace(/_/g, '/')).split('').map(function(c){ return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join('')));
            } catch { return null; }
          })();
          if (payload && payload.role === 'admin') {
            toast.success('Welcome admin');
            navigate('/admin');
          } else {
            toast.error('Access denied: not an admin');
            navigate('/dashboard');
          }
        } catch (e: any) {
          toast.error('Login succeeded but role check failed');
          navigate('/dashboard');
        } finally {
          setLoading(false);
        }
      }, 400);
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-32 pb-12">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Admin Sign In</CardTitle>
            <CardDescription>Please sign in with your admin credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</Button>
            </form>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default AdminLogin;
