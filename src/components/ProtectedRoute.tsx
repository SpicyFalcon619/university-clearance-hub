import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ children, allow }: { children: ReactNode; allow?: AppRole[] }) {
  const { session, role, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" state={{ from: location }} replace />;
  if (allow && role && !allow.includes(role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
