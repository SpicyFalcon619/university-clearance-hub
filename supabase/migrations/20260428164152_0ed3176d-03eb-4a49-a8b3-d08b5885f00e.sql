
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('student', 'dept_admin', 'master_admin');
CREATE TYPE public.application_status AS ENUM ('not_started','in_progress','action_required','completed');
CREATE TYPE public.dept_status AS ENUM ('pending','approved','denied');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  student_id TEXT,
  course TEXT,
  batch TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ DEPARTMENTS ============
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

INSERT INTO public.departments (name, description) VALUES
  ('Library','Book returns and library fines'),
  ('Hostel','Room handover and hostel dues'),
  ('Finance','Tuition and fee dues'),
  ('Examination','Exam-related clearance'),
  ('Sports','Equipment and locker returns'),
  ('Lab','Lab equipment returns');

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, department_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ SECURITY DEFINER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_dept_admin_for(_user_id UUID, _dept_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'dept_admin' AND department_id = _dept_id) $$;

CREATE OR REPLACE FUNCTION public.get_admin_dept(_user_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT department_id FROM public.user_roles WHERE user_id = _user_id AND role = 'dept_admin' LIMIT 1 $$;

-- ============ APPLICATIONS ============
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course TEXT NOT NULL,
  batch TEXT NOT NULL,
  reason TEXT,
  is_emergency BOOLEAN NOT NULL DEFAULT false,
  emergency_justification TEXT,
  overall_status public.application_status NOT NULL DEFAULT 'in_progress',
  certificate_ref TEXT,
  certificate_issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- ============ DEPARTMENT STATUS ============
CREATE TABLE public.department_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  status public.dept_status NOT NULL DEFAULT 'pending',
  comments TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  undo_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, department_id)
);
ALTER TABLE public.department_status ENABLE ROW LEVEL SECURITY;

-- ============ DOCUMENTS ============
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- ============ AUDIT LOG ============
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============ TRIGGERS ============
-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_applications_updated BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_dept_status_updated BEFORE UPDATE ON public.department_status FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- handle_new_user: create profile + student role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-create department_status rows on new application
CREATE OR REPLACE FUNCTION public.seed_dept_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.department_status (application_id, department_id)
  SELECT NEW.id, d.id FROM public.departments d WHERE d.active = true;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_seed_dept_status
AFTER INSERT ON public.applications FOR EACH ROW EXECUTE FUNCTION public.seed_dept_status();

-- Recompute overall status when dept_status changes
CREATE OR REPLACE FUNCTION public.recompute_app_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_app UUID := COALESCE(NEW.application_id, OLD.application_id);
  v_total INT;
  v_approved INT;
  v_denied INT;
  v_new_status public.application_status;
  v_student UUID;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status='approved'), COUNT(*) FILTER (WHERE status='denied')
    INTO v_total, v_approved, v_denied
    FROM public.department_status WHERE application_id = v_app;

  IF v_denied > 0 THEN v_new_status := 'action_required';
  ELSIF v_approved = v_total AND v_total > 0 THEN v_new_status := 'completed';
  ELSE v_new_status := 'in_progress';
  END IF;

  UPDATE public.applications SET overall_status = v_new_status WHERE id = v_app;

  -- create notification for student on dept status change
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT student_id INTO v_student FROM public.applications WHERE id = v_app;
    INSERT INTO public.notifications (user_id, application_id, title, body)
    VALUES (
      v_student, v_app,
      CASE NEW.status WHEN 'approved' THEN 'Department approved your request'
                      WHEN 'denied' THEN 'Department needs action'
                      ELSE 'Status updated' END,
      (SELECT name FROM public.departments WHERE id = NEW.department_id) || ' is now ' || NEW.status::text
    );
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_recompute_status
AFTER INSERT OR UPDATE OR DELETE ON public.department_status
FOR EACH ROW EXECUTE FUNCTION public.recompute_app_status();

-- ============ RLS POLICIES ============
-- profiles
CREATE POLICY "own profile read" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.has_role(auth.uid(),'master_admin') OR public.has_role(auth.uid(),'dept_admin'));
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- departments (publicly readable for authenticated users)
CREATE POLICY "depts read" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "depts master manage" ON public.departments FOR ALL USING (public.has_role(auth.uid(),'master_admin')) WITH CHECK (public.has_role(auth.uid(),'master_admin'));

-- user_roles
CREATE POLICY "roles self read" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'master_admin'));
CREATE POLICY "roles master manage" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(),'master_admin')) WITH CHECK (public.has_role(auth.uid(),'master_admin'));

-- applications
CREATE POLICY "apps student rw" ON public.applications FOR SELECT USING (auth.uid() = student_id OR public.has_role(auth.uid(),'master_admin') OR public.has_role(auth.uid(),'dept_admin'));
CREATE POLICY "apps student insert" ON public.applications FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "apps student update own" ON public.applications FOR UPDATE USING (auth.uid() = student_id OR public.has_role(auth.uid(),'master_admin'));
CREATE POLICY "apps master delete" ON public.applications FOR DELETE USING (public.has_role(auth.uid(),'master_admin'));

-- department_status
CREATE POLICY "ds read" ON public.department_status FOR SELECT USING (
  public.has_role(auth.uid(),'master_admin')
  OR public.is_dept_admin_for(auth.uid(), department_id)
  OR EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.student_id = auth.uid())
);
CREATE POLICY "ds dept admin update" ON public.department_status FOR UPDATE USING (
  public.is_dept_admin_for(auth.uid(), department_id) OR public.has_role(auth.uid(),'master_admin')
);
CREATE POLICY "ds master insert" ON public.department_status FOR INSERT WITH CHECK (
  public.has_role(auth.uid(),'master_admin')
);

-- documents
CREATE POLICY "docs read" ON public.documents FOR SELECT USING (
  uploaded_by = auth.uid()
  OR public.has_role(auth.uid(),'master_admin')
  OR public.has_role(auth.uid(),'dept_admin')
);
CREATE POLICY "docs student insert" ON public.documents FOR INSERT WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "docs student delete own" ON public.documents FOR DELETE USING (uploaded_by = auth.uid());

-- audit_log
CREATE POLICY "audit read" ON public.audit_log FOR SELECT USING (
  public.has_role(auth.uid(),'master_admin')
  OR public.has_role(auth.uid(),'dept_admin')
  OR EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.student_id = auth.uid())
);
CREATE POLICY "audit insert admin" ON public.audit_log FOR INSERT WITH CHECK (
  public.has_role(auth.uid(),'dept_admin') OR public.has_role(auth.uid(),'master_admin')
);

-- notifications
CREATE POLICY "notif own read" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notif own update" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notif system insert" ON public.notifications FOR INSERT WITH CHECK (true);

-- ============ STORAGE ============
INSERT INTO storage.buckets (id, name, public) VALUES ('clearance-docs','clearance-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "docs storage own read" ON storage.objects FOR SELECT USING (
  bucket_id = 'clearance-docs' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(),'master_admin')
    OR public.has_role(auth.uid(),'dept_admin')
  )
);
CREATE POLICY "docs storage own insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'clearance-docs' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "docs storage own delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'clearance-docs' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.department_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.applications;
