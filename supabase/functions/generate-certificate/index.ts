import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { applicationId } = await req.json();
    if (!applicationId) throw new Error("applicationId is required");

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');

    // Initialize clients
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
       { global: { headers: { Authorization: authHeader } } }
    );
    
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify auth from the incoming bearer token
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if requester is master_admin
    const { data: roleRow } = await supabaseService
      .from('user_roles')
      .select('role')
       .eq('user_id', userId)
      .eq('role', 'master_admin')
      .maybeSingle();
    const isMaster = !!roleRow;

    // Fetch application: master_admin can fetch any, students only their own
    let query = supabaseService
      .from('applications')
      .select('*')
      .eq('id', applicationId);
    if (!isMaster) query = query.eq('student_id', userId);
    const { data: app, error: appErr } = await query.single();

    if (appErr || !app) {
      console.error('Application lookup failed', { appErr, applicationId, userId, isMaster });
      throw new Error("Application not found or unauthorized.");
    }
    if (app.overall_status !== 'completed') {
      return new Response(JSON.stringify({ error: "Clearance is not yet completed." }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [{ data: profile }, { data: deptStatuses, error: deptErr }] = await Promise.all([
      supabaseService
        .from('profiles')
        .select('full_name')
        .eq('id', app.student_id)
        .maybeSingle(),
      supabaseService
        .from('department_status')
        .select('status, departments(name)')
        .eq('application_id', app.id),
    ]);

    if (deptErr) {
      console.error('Department status lookup failed', { deptErr, applicationId: app.id });
      throw new Error('Could not load department approvals.');
    }

    // Generate or fetch certificate reference
    let ref = app.certificate_ref;
    if (!ref) {
      ref = `CL-${new Date().getFullYear()}-${app.id.slice(0, 8).toUpperCase()}`;
      await supabaseService.from('applications').update({
        certificate_ref: ref,
        certificate_issued_at: new Date().toISOString()
      }).eq('id', app.id);
    }
    
    const depts = (deptStatuses || []).map((ds: any) => ds.departments?.name).filter(Boolean);

    // Generate PDF using pdf-lib
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([841.89, 595.28]); // A4 Landscape
    const { width: W, height: H } = page.getSize();
    
    const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Outer border
    page.drawRectangle({ x: 24, y: 24, width: W - 48, height: H - 48, borderColor: rgb(0.1, 0.1, 0.15), borderWidth: 2 });
    // Inner border
    page.drawRectangle({ x: 34, y: 34, width: W - 68, height: H - 68, borderColor: rgb(0.1, 0.1, 0.15), borderWidth: 0.5 });
    
    // Title
    page.drawText("Certificate of Clearance", { x: W / 2 - 200, y: H - 110, size: 34, font: fontBold, color: rgb(0.08, 0.08, 0.12) });
    page.drawText("UNIVERSITY ONLINE CLEARANCE SYSTEM", { x: W / 2 - 130, y: H - 140, size: 11, font: fontNormal, color: rgb(0.35, 0.35, 0.39) });
    
    // Body
    page.drawText("This is to certify that", { x: W / 2 - 60, y: H - 220, size: 13, font: fontNormal, color: rgb(0.15, 0.15, 0.2) });
    
    const nameStr = profile?.full_name || "Student";
    const nameWidth = fontBold.widthOfTextAtSize(nameStr, 26);
    page.drawText(nameStr, { x: W / 2 - (nameWidth / 2), y: H - 270, size: 26, font: fontBold, color: rgb(0, 0, 0) });
    
    const line1 = `enrolled in ${app.course} (${app.batch}) has successfully completed all institutional clearance`;
    page.drawText(line1, { x: W / 2 - (fontNormal.widthOfTextAtSize(line1, 13)/2), y: H - 320, size: 13, font: fontNormal, color: rgb(0.23, 0.23, 0.27) });
    
    const line2 = "requirements across the following departments:";
    page.drawText(line2, { x: W / 2 - (fontNormal.widthOfTextAtSize(line2, 13)/2), y: H - 340, size: 13, font: fontNormal, color: rgb(0.23, 0.23, 0.27) });
    
    const deptStr = depts.join("  ·  ");
    page.drawText(deptStr, { x: W / 2 - (fontBold.widthOfTextAtSize(deptStr, 12)/2), y: H - 380, size: 12, font: fontBold, color: rgb(0.08, 0.08, 0.12) });
    
    // Footer
    page.drawText(`Reference: ${ref}`, { x: 60, y: 70, size: 10, font: fontNormal, color: rgb(0.43, 0.43, 0.47) });
    page.drawText(`Issued: ${new Date(app.certificate_issued_at || Date.now()).toLocaleDateString()}`, { x: 60, y: 54, size: 10, font: fontNormal, color: rgb(0.43, 0.43, 0.47) });
    
    page.drawLine({ start: { x: W - 240, y: 80 }, end: { x: W - 60, y: 80 }, thickness: 1, color: rgb(0.08, 0.08, 0.12) });
    page.drawText("Registrar's Office", { x: W - 180, y: 64, size: 10, font: fontNormal, color: rgb(0.08, 0.08, 0.12) });

    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Clearance-Certificate-${ref}.pdf"`
      },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
