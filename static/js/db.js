// ============================================================
// Data layer — uniform API used by all pages.
// Switches between Lovable Cloud (Supabase) and a localStorage
// mock based on APP_CONFIG.MODE.
// ============================================================
window.DB = (() => {
  const cfg = window.APP_CONFIG;
  const isCloud = cfg.MODE === "cloud";

  // ---------- LOCAL MODE ----------
  const LS_KEY = "ocs.localdb.v1";
  const SESSION_KEY = "ocs.session.v1";

  const seed = () => {
    const depts = cfg.DEFAULT_DEPARTMENTS.map((d) => ({
      id: U.uid(), name: d.name, description: d.description, active: true,
      created_at: new Date().toISOString(),
    }));
    return {
      users: [],            // {id,email,password,full_name,student_id,course,batch,created_at}
      profiles: [],         // duplicated minimal user info
      user_roles: [],       // {id,user_id,role,department_id}
      departments: depts,
      applications: [],     // {id,student_id,course,batch,reason,is_emergency,emergency_justification,overall_status,certificate_ref,certificate_issued_at,created_at,updated_at,dues}
      department_status: [],// {id,application_id,department_id,status,comments,reviewed_by,reviewed_at,undo_deadline,updated_at}
      documents: [],        // {id,application_id,department_id,uploaded_by,file_name,file_path,mime_type,size_bytes,created_at, data_url}
      audit_log: [],        // {id,application_id,department_id,actor_id,action,comments,created_at}
      notifications: [],    // {id,user_id,application_id,title,body,read,created_at}
      dues_catalog: cfg.DEFAULT_DUES, // by dept name
    };
  };
  const load = () => {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      const s = seed();
      localStorage.setItem(LS_KEY, JSON.stringify(s));
      return s;
    }
    try { return JSON.parse(raw); } catch { return seed(); }
  };
  const save = (s) => localStorage.setItem(LS_KEY, JSON.stringify(s));
  const getSession = () => {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  };
  const setSession = (s) => {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  };

  // Recompute application overall_status + emit notification
  const recompute = (state, appId) => {
    const ds = state.department_status.filter((s) => s.application_id === appId);
    const total = ds.length;
    const approved = ds.filter((s) => s.status === "approved").length;
    const denied = ds.filter((s) => s.status === "denied").length;
    let status = "in_progress";
    if (denied > 0) status = "action_required";
    else if (total > 0 && approved === total) status = "completed";
    const app = state.applications.find((a) => a.id === appId);
    if (app) {
      app.overall_status = status;
      app.updated_at = new Date().toISOString();
      if (status === "completed" && !app.certificate_ref) {
        app.certificate_ref = U.certRef(app.id);
        app.certificate_issued_at = new Date().toISOString();
      }
    }
  };

  const notify = (state, user_id, application_id, title, body) => {
    state.notifications.push({
      id: U.uid(), user_id, application_id, title, body,
      read: false, created_at: new Date().toISOString(),
    });
  };

  // ---------- CLOUD MODE ----------
  let supa = null;
  if (isCloud) {
    if (!window.supabase) {
      console.error("Supabase JS not loaded");
    } else {
      supa = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
        auth: { storage: localStorage, persistSession: true, autoRefreshToken: true },
      });
    }
  }

  // ---------- API ----------
  const api = {
    mode: cfg.MODE,
    supa,

    // ---- AUTH ----
    async signUp({ email, password, full_name }) {
      if (isCloud) {
        const { data, error } = await supa.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/static/", data: { full_name } },
        });
        if (error) throw error;
        return data;
      }
      const state = load();
      if (state.users.find((u) => u.email.toLowerCase() === email.toLowerCase()))
        throw new Error("Email already registered");
      const id = U.uid();
      const user = { id, email, password, full_name, created_at: new Date().toISOString() };
      state.users.push(user);
      state.profiles.push({ id, full_name, email, student_id: null, course: null, batch: null });
      // First user becomes master_admin (bootstrap parity with cloud trigger)
      const isFirstAdmin = !state.user_roles.find((r) => r.role === "master_admin");
      state.user_roles.push({
        id: U.uid(), user_id: id,
        role: isFirstAdmin ? "master_admin" : "student",
      });
      save(state);
      setSession({ user: { id, email } });
      return { user };
    },

    async signIn({ email, password }) {
      if (isCloud) {
        const { data, error } = await supa.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
      }
      const state = load();
      const u = state.users.find((x) => x.email.toLowerCase() === email.toLowerCase() && x.password === password);
      if (!u) throw new Error("Invalid email or password");
      setSession({ user: { id: u.id, email: u.email } });
      return { user: { id: u.id, email: u.email } };
    },

    async signOut() {
      if (isCloud) await supa.auth.signOut();
      else setSession(null);
    },

    async getCurrentUser() {
      if (isCloud) {
        const { data } = await supa.auth.getUser();
        return data.user || null;
      }
      const s = getSession();
      return s?.user || null;
    },

    async getRole(userId) {
      if (isCloud) {
        const { data } = await supa.from("user_roles").select("role,department_id").eq("user_id", userId);
        if (!data || data.length === 0) return { role: "student", department_id: null };
        const priority = ["master_admin", "dept_admin", "student"];
        const sorted = data.sort((a, b) => priority.indexOf(a.role) - priority.indexOf(b.role));
        return sorted[0];
      }
      const state = load();
      const roles = state.user_roles.filter((r) => r.user_id === userId);
      if (roles.length === 0) return { role: "student", department_id: null };
      const priority = ["master_admin", "dept_admin", "student"];
      roles.sort((a, b) => priority.indexOf(a.role) - priority.indexOf(b.role));
      return { role: roles[0].role, department_id: roles[0].department_id || null };
    },

    async getProfile(userId) {
      if (isCloud) {
        const { data } = await supa.from("profiles").select("*").eq("id", userId).maybeSingle();
        return data;
      }
      return load().profiles.find((p) => p.id === userId) || null;
    },

    async updateProfile(userId, patch) {
      if (isCloud) {
        const { error } = await supa.from("profiles").update(patch).eq("id", userId);
        if (error) throw error;
      } else {
        const state = load();
        const p = state.profiles.find((x) => x.id === userId);
        Object.assign(p, patch);
        save(state);
      }
    },

    // ---- DEPARTMENTS ----
    async listDepartments() {
      if (isCloud) {
        const { data } = await supa.from("departments").select("*").order("name");
        return data || [];
      }
      return load().departments.sort((a, b) => a.name.localeCompare(b.name));
    },
    async addDepartment({ name, description }) {
      if (isCloud) {
        const { error } = await supa.from("departments").insert({ name, description, active: true });
        if (error) throw error;
      } else {
        const state = load();
        state.departments.push({ id: U.uid(), name, description, active: true, created_at: new Date().toISOString() });
        save(state);
      }
    },
    async toggleDepartment(id, active) {
      if (isCloud) {
        const { error } = await supa.from("departments").update({ active }).eq("id", id);
        if (error) throw error;
      } else {
        const state = load();
        const d = state.departments.find((x) => x.id === id);
        if (d) d.active = active;
        save(state);
      }
    },
    async deleteDepartment(id) {
      if (isCloud) {
        const { error } = await supa.from("departments").delete().eq("id", id);
        if (error) throw error;
      } else {
        const state = load();
        state.departments = state.departments.filter((d) => d.id !== id);
        save(state);
      }
    },

    // ---- APPLICATIONS ----
    async myApplications(studentId) {
      if (isCloud) {
        const { data } = await supa.from("applications").select("*").eq("student_id", studentId).order("created_at", { ascending: false });
        return data || [];
      }
      return load().applications.filter((a) => a.student_id === studentId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    async allApplications() {
      if (isCloud) {
        const { data } = await supa.from("applications").select("*").order("created_at", { ascending: false });
        return data || [];
      }
      return [...load().applications].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    async getApplication(id) {
      if (isCloud) {
        const { data } = await supa.from("applications").select("*").eq("id", id).maybeSingle();
        return data;
      }
      return load().applications.find((a) => a.id === id) || null;
    },
    async createApplication({ student_id, course, batch, reason, is_emergency, emergency_justification }) {
      if (isCloud) {
        const { data, error } = await supa.from("applications")
          .insert({ student_id, course, batch, reason, is_emergency, emergency_justification })
          .select().single();
        if (error) throw error;
        return data;
      }
      const state = load();
      const app = {
        id: U.uid(), student_id, course, batch, reason: reason || null,
        is_emergency: !!is_emergency, emergency_justification: emergency_justification || null,
        overall_status: "in_progress",
        certificate_ref: null, certificate_issued_at: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      state.applications.push(app);
      // Seed department_status with dues per department from catalog
      state.departments.filter((d) => d.active).forEach((d) => {
        state.department_status.push({
          id: U.uid(), application_id: app.id, department_id: d.id,
          status: "pending", comments: null, reviewed_by: null,
          reviewed_at: null, undo_deadline: null, updated_at: new Date().toISOString(),
          dues: state.dues_catalog[d.name] ? JSON.parse(JSON.stringify(state.dues_catalog[d.name])) : [],
        });
      });
      save(state);
      return app;
    },

    // ---- DEPARTMENT STATUS ----
    async statusesForApp(appId) {
      if (isCloud) {
        const { data } = await supa.from("department_status").select("*").eq("application_id", appId);
        return data || [];
      }
      return load().department_status.filter((s) => s.application_id === appId);
    },
    async pendingForDept(deptId) {
      if (isCloud) {
        const { data } = await supa.from("department_status").select("*").eq("department_id", deptId);
        return data || [];
      }
      return load().department_status.filter((s) => s.department_id === deptId);
    },
    async reviewStatus(dsId, { status, comments, actor_id }) {
      if (isCloud) {
        const undo = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        const { data: row, error } = await supa.from("department_status").update({
          status, comments: comments || null, reviewed_by: actor_id,
          reviewed_at: new Date().toISOString(), undo_deadline: undo,
        }).eq("id", dsId).select().single();
        if (error) throw error;
        await supa.from("audit_log").insert({
          application_id: row.application_id, department_id: row.department_id,
          actor_id, action: status === "approved" ? "approved" : "denied", comments: comments || null,
        });
        return row;
      }
      const state = load();
      const ds = state.department_status.find((s) => s.id === dsId);
      if (!ds) throw new Error("Not found");
      ds.status = status;
      ds.comments = comments || null;
      ds.reviewed_by = actor_id;
      ds.reviewed_at = new Date().toISOString();
      ds.undo_deadline = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      ds.updated_at = ds.reviewed_at;
      state.audit_log.push({
        id: U.uid(), application_id: ds.application_id, department_id: ds.department_id,
        actor_id, action: status === "approved" ? "approved" : "denied",
        comments: comments || null, created_at: new Date().toISOString(),
      });
      const app = state.applications.find((a) => a.id === ds.application_id);
      const deptName = state.departments.find((d) => d.id === ds.department_id)?.name || "Department";
      if (app) {
        notify(state, app.student_id, app.id,
          status === "approved" ? "Department approved your request" : "Department needs action",
          `${deptName} is now ${status}`);
      }
      recompute(state, ds.application_id);
      save(state);
      return ds;
    },
    async undoReview(dsId, actor_id) {
      if (isCloud) {
        const { data: row, error } = await supa.from("department_status").update({
          status: "pending", comments: null, reviewed_at: null, undo_deadline: null,
        }).eq("id", dsId).select().single();
        if (error) throw error;
        await supa.from("audit_log").insert({
          application_id: row.application_id, department_id: row.department_id,
          actor_id, action: "undo", comments: null,
        });
        return row;
      }
      const state = load();
      const ds = state.department_status.find((s) => s.id === dsId);
      if (!ds) throw new Error("Not found");
      ds.status = "pending"; ds.comments = null; ds.reviewed_at = null; ds.undo_deadline = null;
      state.audit_log.push({
        id: U.uid(), application_id: ds.application_id, department_id: ds.department_id,
        actor_id, action: "undo", comments: null, created_at: new Date().toISOString(),
      });
      recompute(state, ds.application_id);
      save(state);
      return ds;
    },

    // ---- DOCUMENTS ----
    async uploadDocument({ application_id, department_id, uploaded_by, file }) {
      if (isCloud) {
        const path = `${uploaded_by}/${application_id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supa.storage.from("clearance-docs").upload(path, file);
        if (upErr) throw upErr;
        const { error } = await supa.from("documents").insert({
          application_id, department_id, uploaded_by,
          file_name: file.name, file_path: path,
          mime_type: file.type, size_bytes: file.size,
        });
        if (error) throw error;
        return;
      }
      const data_url = await new Promise((res) => {
        const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file);
      });
      const state = load();
      state.documents.push({
        id: U.uid(), application_id, department_id, uploaded_by,
        file_name: file.name, file_path: `local://${file.name}`,
        mime_type: file.type, size_bytes: file.size,
        created_at: new Date().toISOString(), data_url,
      });
      save(state);
    },
    async listDocuments(application_id) {
      if (isCloud) {
        const { data } = await supa.from("documents").select("*").eq("application_id", application_id);
        return data || [];
      }
      return load().documents.filter((d) => d.application_id === application_id);
    },
    async deleteDocument(id) {
      if (isCloud) {
        const { data } = await supa.from("documents").select("*").eq("id", id).maybeSingle();
        if (data?.file_path) await supa.storage.from("clearance-docs").remove([data.file_path]);
        await supa.from("documents").delete().eq("id", id);
      } else {
        const state = load();
        state.documents = state.documents.filter((d) => d.id !== id);
        save(state);
      }
    },

    // ---- AUDIT ----
    async auditForApp(appId) {
      if (isCloud) {
        const { data } = await supa.from("audit_log").select("*")
          .eq("application_id", appId).order("created_at", { ascending: false });
        return data || [];
      }
      return load().audit_log.filter((a) => a.application_id === appId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },

    // ---- NOTIFICATIONS ----
    async myNotifications(userId) {
      if (isCloud) {
        const { data } = await supa.from("notifications").select("*")
          .eq("user_id", userId).order("created_at", { ascending: false });
        return data || [];
      }
      return load().notifications.filter((n) => n.user_id === userId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    async markNotifRead(id) {
      if (isCloud) {
        await supa.from("notifications").update({ read: true }).eq("id", id);
      } else {
        const state = load();
        const n = state.notifications.find((x) => x.id === id);
        if (n) n.read = true;
        save(state);
      }
    },

    // ---- ADMIN-ONLY ----
    async listProfiles() {
      if (isCloud) {
        const { data } = await supa.from("profiles").select("*");
        return data || [];
      }
      return load().profiles;
    },
    async listRoles() {
      if (isCloud) {
        const { data } = await supa.from("user_roles").select("*");
        return data || [];
      }
      return load().user_roles;
    },
    async setUserRole(user_id, role, department_id = null) {
      if (isCloud) {
        await supa.from("user_roles").delete().eq("user_id", user_id);
        await supa.from("user_roles").insert({ user_id, role, department_id });
      } else {
        const state = load();
        state.user_roles = state.user_roles.filter((r) => r.user_id !== user_id);
        state.user_roles.push({ id: U.uid(), user_id, role, department_id });
        save(state);
      }
    },
    async overrideStatus(dsId, status, comments, actor_id) {
      // Same as reviewStatus but tagged as "master_override"
      if (isCloud) {
        const { data: row, error } = await supa.from("department_status").update({
          status, comments: comments || null, reviewed_by: actor_id,
          reviewed_at: new Date().toISOString(), undo_deadline: null,
        }).eq("id", dsId).select().single();
        if (error) throw error;
        await supa.from("audit_log").insert({
          application_id: row.application_id, department_id: row.department_id,
          actor_id, action: "master_override_" + status, comments: comments || null,
        });
        return row;
      }
      const state = load();
      const ds = state.department_status.find((s) => s.id === dsId);
      ds.status = status; ds.comments = comments || null; ds.reviewed_by = actor_id;
      ds.reviewed_at = new Date().toISOString(); ds.undo_deadline = null;
      state.audit_log.push({
        id: U.uid(), application_id: ds.application_id, department_id: ds.department_id,
        actor_id, action: "master_override_" + status, comments, created_at: new Date().toISOString(),
      });
      recompute(state, ds.application_id);
      save(state);
      return ds;
    },

    // ---- DEMO HELPERS (local mode only) ----
    async _seedDemoData() {
      if (isCloud) { U.toast("Demo seeding only available in local mode", "error"); return; }
      const state = load();
      // make sure we have an admin already
      if (!state.users.length) { U.toast("Sign up first as the master admin.", "error"); return; }

      const mkUser = (email, full_name, role, department_id = null, extra = {}) => {
        if (state.users.find((u) => u.email === email)) return state.users.find((u) => u.email === email);
        const id = U.uid();
        state.users.push({ id, email, password: "demo1234", full_name, created_at: new Date().toISOString() });
        state.profiles.push({ id, full_name, email, ...extra });
        state.user_roles.push({ id: U.uid(), user_id: id, role, department_id });
        return state.users[state.users.length - 1];
      };
      const libDept = state.departments.find((d) => d.name === "Library");
      const finDept = state.departments.find((d) => d.name === "Finance");
      mkUser("librarian@uni.edu", "Library Admin", "dept_admin", libDept?.id);
      mkUser("finance@uni.edu", "Finance Admin", "dept_admin", finDept?.id);
      const stu = mkUser("alice@uni.edu", "Alice Student", "student", null,
        { student_id: "STU2026001", course: "B.Tech CSE", batch: "2022-2026" });
      const stu2 = mkUser("bob@uni.edu", "Bob Student", "student", null,
        { student_id: "STU2026002", course: "B.Sc Math", batch: "2023-2027" });
      save(state);
      // Create one application for each student
      await api.createApplication({ student_id: stu.id, course: "B.Tech CSE", batch: "2022-2026", reason: "Graduation clearance", is_emergency: false });
      await api.createApplication({ student_id: stu2.id, course: "B.Sc Math", batch: "2023-2027", reason: "Transfer", is_emergency: true, emergency_justification: "Family relocation" });
      U.toast("Demo data seeded! Logins: librarian@uni.edu / finance@uni.edu / alice@uni.edu / bob@uni.edu — pwd: demo1234", "success");
    },

    async _resetLocal() {
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(SESSION_KEY);
      U.toast("Local data wiped.", "success");
    },
  };

  return api;
})();
