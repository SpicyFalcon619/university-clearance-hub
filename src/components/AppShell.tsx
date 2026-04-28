import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { GraduationCap, LayoutDashboard, FileText, Settings, LogOut, Bell, Building2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const { role, signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const studentNav = [
    { to: "/", label: "Dashboard", Icon: LayoutDashboard },
    { to: "/apply", label: "New Application", Icon: FileText },
  ];
  const deptNav = [
    { to: "/department", label: "Queue", Icon: LayoutDashboard },
  ];
  const masterNav = [
    { to: "/admin", label: "Overview", Icon: LayoutDashboard },
    { to: "/admin/students", label: "Students", Icon: Users },
    { to: "/admin/departments", label: "Departments", Icon: Building2 },
  ];

  const nav = role === "master_admin" ? masterNav : role === "dept_admin" ? deptNav : studentNav;

  return (
    <div className="min-h-screen bg-surface-2 flex flex-col">
      <header className="sticky top-0 z-40 surface-1 border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-14">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <div className="w-7 h-7 rounded-md bg-foreground text-background flex items-center justify-center">
                <GraduationCap className="w-4 h-4" />
              </div>
              <span>ClearPath</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {nav.map(({ to, label, Icon }) => {
                const active = location.pathname === to;
                return (
                  <Link key={to} to={to}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                      active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                    )}>
                    <Icon className="w-4 h-4" />{label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {role === "student" && (
              <Button variant="ghost" size="icon" onClick={() => navigate("/notifications")} aria-label="Notifications">
                <Bell className="w-4 h-4" />
              </Button>
            )}
            <span className="hidden sm:inline text-xs text-muted-foreground max-w-[180px] truncate">{user?.email}</span>
            <Button variant="ghost" size="icon" onClick={async () => { await signOut(); navigate("/auth"); }} aria-label="Sign out">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {/* Mobile nav */}
        <nav className="md:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto">
          {nav.map(({ to, label, Icon }) => {
            const active = location.pathname === to;
            return (
              <Link key={to} to={to}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap",
                  active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"
                )}>
                <Icon className="w-3.5 h-3.5" />{label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
