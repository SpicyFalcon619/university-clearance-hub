export type Department = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
};

export type Application = {
  id: string;
  student_id: string;
  course: string;
  batch: string;
  reason: string | null;
  is_emergency: boolean;
  emergency_justification: string | null;
  overall_status: "not_started" | "in_progress" | "action_required" | "completed";
  certificate_ref: string | null;
  certificate_issued_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DeptStatusRow = {
  id: string;
  application_id: string;
  department_id: string;
  status: "pending" | "approved" | "denied";
  comments: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  undo_deadline: string | null;
  updated_at: string;
};

export type DocumentRow = {
  id: string;
  application_id: string;
  department_id: string | null;
  uploaded_by: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  student_id: string | null;
  course: string | null;
  batch: string | null;
};
