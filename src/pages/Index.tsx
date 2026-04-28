import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { StudentDashboard } from "@/features/student/StudentDashboard";
import { DepartmentDashboard } from "@/features/dept/DepartmentDashboard";
import { MasterDashboard } from "@/features/master/MasterDashboard";
import { AppShell } from "@/components/AppShell";
import { Loader2 } from "lucide-react";

export default function Index() {
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate("/auth", { replace: true });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AppShell>
      {role === "master_admin" ? <MasterDashboard /> :
       role === "dept_admin" ? <DepartmentDashboard /> :
       <StudentDashboard />}
    </AppShell>
  );
}
