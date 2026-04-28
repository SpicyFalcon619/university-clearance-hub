import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Bell } from "lucide-react";

export default function Notifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setItems(data || []));
    supabase.from("notifications").update({ read: true }).eq("user_id", user.id).then(() => {});
  }, [user?.id]);

  return (
    <AppShell>
      <div className="max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        {items.length === 0 ? (
          <Card><CardContent className="py-12 text-center space-y-2">
            <Bell className="w-5 h-5 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          </CardContent></Card>
        ) : items.map(n => (
          <Card key={n.id}>
            <CardContent className="py-3">
              <div className="text-sm font-medium">{n.title}</div>
              {n.body && <div className="text-sm text-muted-foreground">{n.body}</div>}
              <div className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
