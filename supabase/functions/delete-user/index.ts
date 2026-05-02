// Master-admin-only edge function to delete a user (auth + cascading data).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verify caller is master_admin
    const { data: roles } = await admin
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "master_admin");
    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Forbidden — master admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (userId === user.id) {
      return new Response(JSON.stringify({ error: "You cannot delete your own account" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cleanup app data first (no FK cascades exist)
    // Find applications owned by this user, then delete dependent rows.
    const { data: apps } = await admin
      .from("applications").select("id").eq("student_id", userId);
    const appIds = (apps || []).map((a: { id: string }) => a.id);

    if (appIds.length > 0) {
      await admin.from("audit_log").delete().in("application_id", appIds);
      await admin.from("department_status").delete().in("application_id", appIds);
      await admin.from("documents").delete().in("application_id", appIds);
      await admin.from("notifications").delete().in("application_id", appIds);
      await admin.from("applications").delete().in("id", appIds);
    }

    // Audit/document rows where this user was the actor/uploader but app belongs to someone else
    await admin.from("audit_log").delete().eq("actor_id", userId);
    await admin.from("documents").delete().eq("uploaded_by", userId);

    await admin.from("user_roles").delete().eq("user_id", userId);
    await admin.from("notifications").delete().eq("user_id", userId);
    await admin.from("profiles").delete().eq("id", userId);

    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      console.error("auth.admin.deleteUser failed:", delErr);
      throw delErr;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
