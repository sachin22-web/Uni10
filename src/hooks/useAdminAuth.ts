import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type MeResponse = {
  ok: boolean;
  user?: { id: string; name: string; email: string; role?: "admin" | "user" };
};

export function useAdminAuth() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<MeResponse['user'] | null>(null);

  useEffect(() => { checkAdminStatus(); }, []);

  const checkAdminStatus = async () => {
    try {
      const { ok, json } = await api("/api/auth/me");
      const data = (json || {}) as MeResponse;

      if (!ok || !data.ok || !data.user) {
        setIsAdmin(false);
        setUser(null);
        setLoading(false);
        return;
      }
      setUser(data.user);
      setIsAdmin(data.user.role === "admin");
      setLoading(false);
    } catch {
      setIsAdmin(false);
      setUser(null);
      setLoading(false);
    }
  };

  return { isAdmin, loading, user };
}
