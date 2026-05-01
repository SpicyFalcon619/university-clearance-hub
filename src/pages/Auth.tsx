import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const signUpSchema = z.object({
  full_name: z.string().trim().min(2, "Name is required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(8, "Min 8 characters").max(72),
});
const loginSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(1, "Password required").max(72),
});

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [signUpForm, setSignUpForm] = useState({ full_name: "", email: "", password: "" });
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signUpSchema.safeParse(signUpForm);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: parsed.data.full_name },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Account created. Welcome!");
    navigate("/");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse(loginForm);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-surface-2 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <Link to="/" className="flex items-center gap-2 justify-center font-semibold text-lg text-primary">
          <div className="w-8 h-8 rounded-md text-background flex items-center justify-center bg-primary">
            <GraduationCap className="w-4 h-4" />
          </div>
          ClearPath
        </Link>
        <Card className="shadow-elevate-md">
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Sign in to manage your university clearance</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid grid-cols-2 w-full mb-4">
                <TabsTrigger value="login">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="li-email">Email</Label>
                    <Input id="li-email" type="email" required value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="li-pw">Password</Label>
                    <Input id="li-pw" type="password" required value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Sign in
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="su-name">Full name</Label>
                    <Input id="su-name" required value={signUpForm.full_name}
                      onChange={(e) => setSignUpForm({ ...signUpForm, full_name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-email">Email</Label>
                    <Input id="su-email" type="email" required value={signUpForm.email}
                      onChange={(e) => setSignUpForm({ ...signUpForm, email: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-pw">Password</Label>
                    <Input id="su-pw" type="password" required minLength={8} value={signUpForm.password}
                      onChange={(e) => setSignUpForm({ ...signUpForm, password: e.target.value })} />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
            <p className="text-xs text-muted-foreground mt-4 text-center">
              New accounts start as Students. Admin roles are assigned by Master Admin.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
