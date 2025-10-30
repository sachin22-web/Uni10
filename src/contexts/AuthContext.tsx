import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "@/lib/api";

type Role = "user" | "admin";
type User = { id: string; name: string; email: string; role: Role } | null;

type AuthContextType = {
  user: User;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string, phone?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as any);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  const parseJwt = (token: string) => {
    try {
      const p = token.split('.')[1];
      const json = JSON.parse(decodeURIComponent(atob(p.replace(/-/g, '+').replace(/_/g, '/')).split('').map(function(c){
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join('')));
      return json;
    } catch {
      return null;
    }
  };

  const refresh = async () => {
    const res = await api("/api/auth/me");
    // network failure (status 0) -> try token fallback to avoid accidental logout in preview where backend isn't accessible
    if (!res.ok && res.status === 0) {
      try {
        const token = (typeof window !== 'undefined') ? localStorage.getItem('token') : null;
        if (token) {
          const payload: any = parseJwt(token) || {};
          const fallbackUser = { id: payload.id || payload._id || payload.sub || null, name: (payload.name as string) || '', email: (payload.email as string) || '' } as any;
          setUser(fallbackUser);
          return;
        }
      } catch (e) {
        // ignore
      }
      // if no token fallback, leave user as null
      setUser(null);
      return;
    }

    setUser(res.ok && res.json?.ok ? res.json.user : null);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { ok, json } = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (ok) {
      try {
        if (json?.token && typeof window !== 'undefined') localStorage.setItem('token', json.token);
      } catch {}
      if (json?.user) setUser(json.user);
      await refresh();
    }
    return { error: ok ? null : json };
  };

  const signUp = async (email: string, password: string, name: string, phone?: string) => {
    const { ok, json } = await api("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, password, phone }),
    });
    if (ok) {
      try {
        if (json?.token && typeof window !== 'undefined') localStorage.setItem('token', json.token);
      } catch {}
      if (json?.user) setUser(json.user);
      await refresh();
    }
    return { error: ok ? null : json };
  };

  const signOut = async () => {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
    try { if (typeof window !== 'undefined') localStorage.removeItem('token'); } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
