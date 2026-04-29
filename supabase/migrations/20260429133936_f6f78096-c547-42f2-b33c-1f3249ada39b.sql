-- Bootstrap trigger: auto-promote first signup to master_admin if none exist
CREATE OR REPLACE FUNCTION public.bootstrap_first_master_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'master_admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'master_admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bootstrap_first_master_admin_trigger ON auth.users;
CREATE TRIGGER bootstrap_first_master_admin_trigger
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.bootstrap_first_master_admin();