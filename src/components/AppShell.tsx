import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { GraduationCap, LayoutDashboard, FileText, LogOut, Bell, Building2, Users, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

type NavItem = { to: string; label: string; Icon: any };

function AnimatedTabs({ items }: { items: NavItem[] }) {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicator, setIndicator] = useState<{ left: number; width: number; visible: boolean }>({ left: 0, width: 0, visible: false });

  const activeKey = items.find((i) => i.to === location.pathname)?.to;

  useLayoutEffect(() => {
    if (!activeKey || !containerRef.current) {
      setIndicator((s) => ({ ...s, visible: false }));
      return;
    }
    const el = itemRefs.current[activeKey];
    if (!el) return;
    const cRect = containerRef.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setIndicator({ left: r.left - cRect.left, width: r.width, visible: true });
  }, [activeKey, items.length]);

  useEffect(() => {
    const onResize = () => {
      if (!activeKey || !containerRef.current) return;
      const el = itemRefs.current[activeKey];
      if (!el) return;
      const cRect = containerRef.current.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      setIndicator({ left: r.left - cRect.left, width: r.width, visible: true });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [activeKey]);

  return (
    <div ref={containerRef} className="tab-bar">
      {indicator.visible && (
        <span
          className="tab-indicator"
          style={{ left: indicator.left, width: indicator.width }}
          aria-hidden
        />
      )}
      {items.map(({ to, label, Icon }) => {
        const active = location.pathname === to;
        return (
          <Link
            key={to}
            to={to}
            ref={(el) => (itemRefs.current[to] = el)}
            data-active={active}
            className="tab-item"
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { role, signOut, user } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const studentNav: NavItem[] = [
    { to: "/", label: "Dashboard", Icon: LayoutDashboard },
    { to: "/apply", label: "New Application", Icon: FileText },
  ];
  const deptNav: NavItem[] = [
    { to: "/department", label: "Queue", Icon: LayoutDashboard },
  ];
  const masterNav: NavItem[] = [
    { to: "/admin", label: "Overview", Icon: LayoutDashboard },
    { to: "/admin/students", label: "Users", Icon: Users },
    { to: "/admin/departments", label: "Departments", Icon: Building2 },
  ];

  const nav = role === "master_admin" ? masterNav : role === "dept_admin" ? deptNav : studentNav;

  return (
    <div className="min-h-screen bg-surface-2 flex flex-col">
      <header className="sticky top-0 z-40 surface-1 border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <div className="w-8 h-8 rounded-lg brand-gradient text-primary-foreground flex items-center justify-center shadow-elevate-sm">
                <GraduationCap className="w-4 h-4" />
              </div>
              <span className="text-base">UIU <span className="brand-text-gradient">ClearPath</span></span>
            </Link>
            <nav className="hidden md:block">
              <AnimatedTabs items={nav} />
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {role === "student" && (
              <Button variant="ghost" size="icon" onClick={() => navigate("/notifications")} aria-label="Notifications">
                <Bell className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="hover-scale"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <span className="hidden sm:inline text-xs text-muted-foreground max-w-[180px] truncate">{user?.email}</span>
            <Button variant="ghost" size="icon" onClick={async () => { await signOut(); navigate("/auth"); }} aria-label="Sign out">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {/* Mobile nav */}
        <nav className="md:hidden flex items-center px-4 pb-3 overflow-x-auto">
          <AnimatedTabs items={nav} />
        </nav>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
