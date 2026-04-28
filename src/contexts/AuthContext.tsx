import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "student" | "dept_admin" | "master_admin";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  departmentId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null, user: null, role: null, departmentId: null, loading: true, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess?.user) {
        // defer role fetch
        setTimeout(() => fetchRole(sess.user.id), 0);
      } else {
        setRole(null); setDepartmentId(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchRole(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchRole(uid: string) {
    const { data } = await supabase
      .from("user_roles")
      .select("role, department_id")
      .eq("user_id", uid)
      .order("role", { ascending: true });
    if (data && data.length) {
      // priority: master_admin > dept_admin > student
      const priority: Record<string, number> = { master_admin: 0, dept_admin: 1, student: 2 };
      const sorted = [...data].sort((a, b) => priority[a.role] - priority[b.role]);
      setRole(sorted[0].role as AppRole);
      setDepartmentId(sorted[0].department_id ?? null);
    } else {
      setRole("student");
    }
    setLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setRole(null); setDepartmentId(null); setSession(null);
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, role, departmentId, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
