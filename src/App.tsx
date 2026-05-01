import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Apply from "./pages/Apply";
import Notifications from "./pages/Notifications";
import StudentDetail from "./pages/admin/StudentDetail";
import Departments from "./pages/admin/Departments";
import Students from "./pages/admin/Students";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/apply" element={<ProtectedRoute allow={["student"]}><Apply /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute allow={["student"]}><Notifications /></ProtectedRoute>} />
            <Route path="/department" element={<ProtectedRoute allow={["dept_admin"]}><Index /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute allow={["master_admin"]}><Index /></ProtectedRoute>} />
            <Route path="/admin/students" element={<ProtectedRoute allow={["master_admin"]}><Students /></ProtectedRoute>} />
            <Route path="/admin/students/:id" element={<ProtectedRoute allow={["master_admin"]}><StudentDetail /></ProtectedRoute>} />
            <Route path="/admin/departments" element={<ProtectedRoute allow={["master_admin"]}><Departments /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
