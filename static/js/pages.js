// ============================================================
// All Pages — vanilla DOM
// ============================================================
window.Pages = (() => {
  const { el } = U;

  // ---------- AUTH ----------
  const Auth = () => {
    const wrap = el("div", { class: "auth-page" });
    const card = el("div", { class: "card auth-card" });
    const tabs = el("div", { class: "tabs" });
    const signinTab = el("div", { class: "tab active", text: "Sign in" });
    const signupTab = el("div", { class: "tab", text: "Sign up" });
    tabs.append(signinTab, signupTab);
    const body = el("div", { class: "card-body" });

    const renderTab = (mode) => {
      signinTab.classList.toggle("active", mode === "in");
      signupTab.classList.toggle("active", mode === "up");
      body.innerHTML = "";
      const intro = el("div", { class: "mb-4" }, [
        el("div", { class: "h2 mb-2", text: mode === "in" ? "Welcome back" : "Create your account" }),
        el("div", { class: "muted sm", text: mode === "in"
          ? "Sign in to continue your clearance."
          : "Sign up to apply for clearance." }),
      ]);
      const fullName = el("input", { class: "input", placeholder: "Full name" });
      const email = el("input", { class: "input", type: "email", placeholder: "you@university.edu" });
      const password = el("input", { class: "input", type: "password", placeholder: "Password" });
      const submit = el("button", { class: "btn", text: mode === "in" ? "Sign in" : "Create account", style: { width: "100%" } });

      submit.addEventListener("click", async () => {
        try {
          submit.disabled = true; submit.innerHTML = '<span class="loader"></span>';
          if (mode === "up") {
            await DB.signUp({ email: email.value.trim(), password: password.value, full_name: fullName.value.trim() });
            U.toast("Account created!", "success");
          } else {
            await DB.signIn({ email: email.value.trim(), password: password.value });
            U.toast("Signed in", "success");
          }
          await App.loadAuth();
          App.render();
        } catch (e) {
          U.toast(e.message || "Auth failed", "error");
          submit.disabled = false; submit.textContent = mode === "in" ? "Sign in" : "Create account";
        }
      });

      body.append(intro);
      if (mode === "up") body.append(el("div", { class: "field" }, [el("label", { class: "label", text: "Full name" }), fullName]));
      body.append(
        el("div", { class: "field" }, [el("label", { class: "label", text: "Email" }), email]),
        el("div", { class: "field" }, [el("label", { class: "label", text: "Password" }), password]),
        submit,
        el("p", { class: "helper mt-3", text: DB.mode === "local"
          ? "Local mode: data stays in your browser. The first account becomes Master Admin automatically."
          : "Powered by Lovable Cloud." }),
      );
    };

    signinTab.onclick = () => renderTab("in");
    signupTab.onclick = () => renderTab("up");
    renderTab("in");

    card.append(
      el("div", { class: "card-header" }, [
        el("div", { class: "row gap-2" }, [
          el("div", { class: "logo", style: { width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(135deg,hsl(224 76% 56%),hsl(224 76% 70%))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700" }, text: "CL" }),
          el("div", {}, [
            el("div", { class: "card-title", text: "Online Clearance" }),
            el("div", { class: "card-desc", text: "University clearance system" }),
          ]),
        ]),
      ]),
      tabs,
      body,
    );
    wrap.append(card);
    return wrap;
  };

  // ---------- DASHBOARD ROUTER ----------
  const Dashboard = () => {
    if (App.state.role === "master_admin") return MasterDashboard();
    if (App.state.role === "dept_admin") return DeptDashboard();
    return StudentDashboard();
  };

  // ---------- STUDENT DASHBOARD ----------
  const StudentDashboard = async () => {
    const wrap = el("div", { class: "grid", style: { gap: "20px" } });
    const apps = await DB.myApplications(App.state.user.id);
    const depts = await DB.listDepartments();
    const deptMap = new Map(depts.map((d) => [d.id, d]));

    const head = el("div", { class: "row between wrap" }, [
      el("div", {}, [
        el("div", { class: "h1", text: "My clearance" }),
        el("div", { class: "muted sm", text: "Track every department in real time." }),
      ]),
      el("a", { href: "#/apply", class: "btn", html: U.icon("plus") + " <span>New application</span>" }),
    ]);
    wrap.append(head);

    if (apps.length === 0) {
      wrap.append(el("div", { class: "dashed-empty" }, [
        el("div", { class: "h2 mb-2", text: "No active applications" }),
        el("div", { class: "muted sm mb-3", text: "Start your clearance to settle dues across departments." }),
        el("a", { href: "#/apply", class: "btn", text: "Begin clearance" }),
      ]));
      return wrap;
    }

    for (const app of apps) {
      const statuses = await DB.statusesForApp(app.id);
      const docs = await DB.listDocuments(app.id);
      const approved = statuses.filter((s) => s.status === "approved").length;
      const total = statuses.length;
      const pct = total ? Math.round((approved / total) * 100) : 0;

      const appCard = el("div", { class: "card" });
      appCard.append(
        el("div", { class: "card-header" }, [
          el("div", { class: "row between wrap" }, [
            el("div", {}, [
              el("div", { class: "row gap-2" }, [
                el("div", { class: "card-title", text: `${app.course} · ${app.batch}` }),
                app.is_emergency ? U.statusBadge("emergency") : null,
              ]),
              el("div", { class: "card-desc", text: "Submitted " + U.fmtDate(app.created_at) }),
            ]),
            el("div", { class: "row gap-2" }, [
              U.statusBadge(app.overall_status),
              app.overall_status === "completed"
                ? el("button", { class: "btn btn-sm", html: U.icon("download") + " <span>Certificate</span>",
                    onClick: () => Cert.openCertificate(app, App.state.profile, depts) })
                : null,
            ]),
          ]),
        ]),
      );

      // Progress bar
      appCard.append(el("div", { class: "card-row" }, [
        el("div", { class: "row between mb-2 sm" }, [
          el("span", { text: `Progress · ${approved} of ${total} departments cleared` }),
          el("span", { class: "tabular bold", text: pct + "%" }),
        ]),
        el("div", { style: { height: "6px", background: "hsl(var(--muted))", borderRadius: "999px", overflow: "hidden" } }, [
          el("div", { style: { height: "100%", width: pct + "%", background: "hsl(var(--accent))", transition: "width .3s" } }),
        ]),
      ]));

      // Department list
      const grid = el("div", { class: "grid grid-2", style: { padding: "12px 18px" } });
      for (const s of statuses) {
        const dept = deptMap.get(s.department_id);
        const dues = (s.dues || []);
        const totalDues = dues.reduce((a, b) => a + (b.amount || 0), 0);
        const card = el("div", { class: "list-row", style: { flexDirection: "column", alignItems: "stretch" } });
        card.append(
          el("div", { class: "row between" }, [
            el("div", { class: "bold sm", text: dept?.name || "—" }),
            U.statusBadge(s.status),
          ]),
          dues.length
            ? el("div", { class: "mt-2 xs muted" }, [
                el("div", { class: "kbd-section-title", text: "Dues" }),
                el("ul", { style: { paddingLeft: "16px", margin: "4px 0" } },
                  dues.map((d) => el("li", { html: `${d.item} · <span class="tag-amount${d.amount === 0 ? " ok" : ""}">₹${d.amount}</span>` }))),
                el("div", { class: "row between mt-1" }, [
                  el("span", { class: "muted", text: "Total" }),
                  el("span", { class: `tag-amount${totalDues === 0 ? " ok" : ""}`, text: "₹" + totalDues }),
                ]),
              ])
            : el("div", { class: "mt-1 xs muted", text: "No outstanding dues recorded." }),
          s.comments ? el("div", { class: "mt-2 xs", html: `<strong>Comment:</strong> ${s.comments}` }) : null,
          el("div", { class: "row gap-2 mt-2" }, [
            el("label", { class: "btn btn-outline btn-sm", html: U.icon("upload") + " <span>Upload doc</span>" }, [
              el("input", { type: "file", style: { display: "none" }, onChange: async (e) => {
                const f = e.target.files[0];
                if (!f) return;
                try {
                  await DB.uploadDocument({ application_id: app.id, department_id: s.department_id, uploaded_by: App.state.user.id, file: f });
                  U.toast("Uploaded", "success"); App.render();
                } catch (err) { U.toast(err.message, "error"); }
              }}),
            ]),
            s.status === "denied" ? el("button", {
              class: "btn btn-sm btn-outline", text: "View denial reason",
              onClick: () => U.modal({ title: dept?.name + " — Action required",
                body: el("p", { class: "sm", text: s.comments || "No reason provided." }),
                footer: [] })
            }) : null,
          ]),
        );
        grid.append(card);
      }
      appCard.append(grid);

      // Documents summary
      if (docs.length) {
        appCard.append(el("div", { class: "card-row" }, [
          el("div", { class: "kbd-section-title", text: `Documents (${docs.length})` }),
          el("div", { class: "row gap-2 wrap" },
            docs.map((d) => el("span", { class: "pill", text: `${d.file_name} (${Math.round((d.size_bytes || 0) / 1024)}KB)` }))),
        ]));
      }

      wrap.append(appCard);
    }

    return wrap;
  };

  // ---------- DEPARTMENT ADMIN ----------
  const DeptDashboard = async () => {
    const wrap = el("div", { class: "grid", style: { gap: "20px" } });
    const deptId = App.state.department_id;
    if (!deptId) {
      wrap.append(el("div", { class: "dashed-empty" }, [
        el("div", { class: "h2 mb-2", text: "No department assigned" }),
        el("div", { class: "muted sm", text: "Ask the master admin to assign your account to a department." }),
      ]));
      return wrap;
    }
    const depts = await DB.listDepartments();
    const dept = depts.find((d) => d.id === deptId);
    const rows = await DB.pendingForDept(deptId);
    const apps = await DB.allApplications();
    const profiles = await DB.listProfiles();
    const profMap = new Map(profiles.map((p) => [p.id, p]));
    const appMap = new Map(apps.map((a) => [a.id, a]));

    const pending = rows.filter((r) => r.status === "pending");
    const approved = rows.filter((r) => r.status === "approved");
    const denied = rows.filter((r) => r.status === "denied");

    wrap.append(
      el("div", { class: "row between wrap" }, [
        el("div", {}, [
          el("div", { class: "h1", text: dept?.name + " · Review queue" }),
          el("div", { class: "muted sm", text: dept?.description || "" }),
        ]),
      ]),
      el("div", { class: "grid grid-3" }, [
        statCard("clock", "Pending", pending.length),
        statCard("file_check", "Approved", approved.length),
        statCard("alert", "Denied", denied.length, "danger"),
      ]),
    );

    const tabs = el("div", { class: "tabs" });
    const tabPending = el("div", { class: "tab active", text: `Pending (${pending.length})` });
    const tabApproved = el("div", { class: "tab", text: `Approved (${approved.length})` });
    const tabDenied = el("div", { class: "tab", text: `Denied (${denied.length})` });
    tabs.append(tabPending, tabApproved, tabDenied);

    const list = el("div", { class: "card-body" });
    const renderList = (items, kind) => {
      list.innerHTML = "";
      if (!items.length) {
        list.append(el("div", { class: "dashed-empty", text: "Nothing here." }));
        return;
      }
      items.forEach((s) => {
        const app = appMap.get(s.application_id);
        const stu = app && profMap.get(app.student_id);
        const dues = s.dues || [];
        const total = dues.reduce((a, b) => a + (b.amount || 0), 0);
        const item = el("div", { class: "list-row mb-2", style: { flexDirection: "column", alignItems: "stretch" } });
        item.append(
          el("div", { class: "row between" }, [
            el("div", {}, [
              el("div", { class: "bold sm row gap-2" }, [
                el("span", { text: stu?.full_name || "Student" }),
                app?.is_emergency ? U.statusBadge("emergency") : null,
              ]),
              el("div", { class: "xs muted", text: `${app?.course || "—"} · ${app?.batch || "—"} · ${stu?.email || ""}` }),
            ]),
            U.statusBadge(s.status),
          ]),
          dues.length ? el("div", { class: "mt-2 xs" }, [
            el("div", { class: "kbd-section-title", text: "Dues to verify" }),
            el("ul", { style: { paddingLeft: "16px", margin: "4px 0" } },
              dues.map((d) => el("li", { html: `${d.item} · <span class="tag-amount${d.amount === 0 ? " ok" : ""}">₹${d.amount}</span>` }))),
            el("div", { class: "row between mt-1" }, [
              el("span", { class: "muted", text: "Total dues" }),
              el("span", { class: `tag-amount${total === 0 ? " ok" : ""}`, text: "₹" + total }),
            ]),
          ]) : null,
          s.comments ? el("div", { class: "mt-2 xs", html: `<strong>Comment:</strong> ${s.comments}` }) : null,
        );
        if (kind === "pending") {
          item.append(el("div", { class: "row gap-2 mt-3" }, [
            el("button", { class: "btn btn-success btn-sm", html: U.icon("check") + " <span>Approve</span>",
              onClick: async () => {
                const c = await U.promptDialog("Optional comment for approval", "All clear.");
                if (c === null) return;
                await DB.reviewStatus(s.id, { status: "approved", comments: c, actor_id: App.state.user.id });
                U.toast("Approved", "success"); App.render();
              }}),
            el("button", { class: "btn btn-danger btn-sm", html: U.icon("x") + " <span>Deny</span>",
              onClick: async () => {
                const c = await U.promptDialog("Reason for denial (required)", "");
                if (!c) return;
                await DB.reviewStatus(s.id, { status: "denied", comments: c, actor_id: App.state.user.id });
                U.toast("Marked as needs action", "info"); App.render();
              }}),
            el("a", { class: "btn btn-outline btn-sm", href: "#/admin/students/" + app?.student_id, text: "View student" }),
          ]));
        } else {
          // Allow undo within 5 minutes
          const undoOk = s.undo_deadline && new Date(s.undo_deadline) > new Date();
          item.append(el("div", { class: "row gap-2 mt-3" }, [
            el("div", { class: "xs muted", text: s.reviewed_at ? "Reviewed " + U.fmtDate(s.reviewed_at) : "" }),
            undoOk ? el("button", { class: "btn btn-outline btn-sm", text: "Undo (within 5 min)",
              onClick: async () => {
                await DB.undoReview(s.id, App.state.user.id);
                U.toast("Undone", "success"); App.render();
              }}) : null,
          ]));
        }
        list.append(item);
      });
    };
    tabPending.onclick = () => { tabs.querySelectorAll(".tab").forEach((t) => t.classList.remove("active")); tabPending.classList.add("active"); renderList(pending, "pending"); };
    tabApproved.onclick = () => { tabs.querySelectorAll(".tab").forEach((t) => t.classList.remove("active")); tabApproved.classList.add("active"); renderList(approved, "approved"); };
    tabDenied.onclick = () => { tabs.querySelectorAll(".tab").forEach((t) => t.classList.remove("active")); tabDenied.classList.add("active"); renderList(denied, "denied"); };

    renderList(pending, "pending");
    wrap.append(el("div", { class: "card" }, [tabs, list]));
    return wrap;
  };

  // ---------- MASTER DASHBOARD ----------
  const MasterDashboard = async () => {
    const wrap = el("div", { class: "grid", style: { gap: "20px" } });
    const apps = await DB.allApplications();
    const profiles = await DB.listProfiles();
    const depts = await DB.listDepartments();
    const profMap = new Map(profiles.map((p) => [p.id, p]));

    const total = apps.length;
    const completed = apps.filter((a) => a.overall_status === "completed").length;
    const inProgress = apps.filter((a) => a.overall_status === "in_progress").length;
    const actionReq = apps.filter((a) => a.overall_status === "action_required").length;
    const completionRate = total ? Math.round((completed / total) * 100) : 0;

    // Bottlenecks
    const bottlenecks = new Map();
    for (const a of apps) {
      const ss = await DB.statusesForApp(a.id);
      ss.filter((s) => s.status === "pending").forEach((s) => {
        const n = depts.find((d) => d.id === s.department_id)?.name || "—";
        bottlenecks.set(n, (bottlenecks.get(n) || 0) + 1);
      });
    }

    wrap.append(
      el("div", { class: "row between wrap" }, [
        el("div", {}, [
          el("div", { class: "h1", text: "Overview" }),
          el("div", { class: "muted sm", text: "Global metrics, search, and clearance management." }),
        ]),
        el("button", { class: "btn btn-outline", html: U.icon("download") + " <span>Export CSV</span>",
          onClick: () => exportCsv(apps, profMap) }),
      ]),
      el("div", { class: "grid grid-4" }, [
        statCard("users", "Total applications", total),
        statCard("file_check", "Completion rate", completionRate + "%"),
        statCard("clock", "In progress", inProgress),
        statCard("alert", "Action required", actionReq, "danger"),
      ]),
    );

    // Search + filter + table
    const filterBar = el("div", { class: "row gap-2 wrap" });
    const search = el("input", { class: "input", placeholder: "Search name, email, course…", style: { width: "260px" } });
    const statusSel = el("select", { class: "select", style: { width: "180px" } }, [
      el("option", { value: "all", text: "All statuses" }),
      el("option", { value: "in_progress", text: "In Progress" }),
      el("option", { value: "action_required", text: "Action Required" }),
      el("option", { value: "completed", text: "Completed" }),
    ]);
    filterBar.append(search, statusSel);

    const tableWrap = el("div", { class: "card-body" });
    const renderRows = () => {
      const q = search.value.toLowerCase();
      const sf = statusSel.value;
      const filtered = apps.filter((a) => {
        if (sf !== "all" && a.overall_status !== sf) return false;
        const stu = profMap.get(a.student_id);
        if (q && !((stu?.full_name || "").toLowerCase().includes(q)
          || (stu?.email || "").toLowerCase().includes(q)
          || a.course.toLowerCase().includes(q))) return false;
        return true;
      });
      tableWrap.innerHTML = "";
      if (!filtered.length) {
        tableWrap.append(el("div", { class: "dashed-empty", text: "No applications match your filter." }));
        return;
      }
      filtered.forEach((a) => {
        const stu = profMap.get(a.student_id);
        const row = el("a", { href: "#/admin/students/" + a.student_id, class: "list-row mb-2" }, [
          el("div", { style: { minWidth: 0 } }, [
            el("div", { class: "row gap-2 sm bold" }, [
              el("span", { text: stu?.full_name || "Student" }),
              a.is_emergency ? U.statusBadge("emergency") : null,
            ]),
            el("div", { class: "xs muted", text: `${a.course} · ${a.batch} · ${stu?.email || ""}` }),
          ]),
          U.statusBadge(a.overall_status),
        ]);
        tableWrap.append(row);
      });
    };
    search.addEventListener("input", renderRows);
    statusSel.addEventListener("change", renderRows);

    const main = el("div", { class: "grid", style: { gridTemplateColumns: "2fr 1fr", gap: "16px" } });
    main.append(
      el("div", { class: "card" }, [
        el("div", { class: "card-header" }, [
          el("div", { class: "row between wrap" }, [
            el("div", { class: "card-title", text: "Applications" }),
            filterBar,
          ]),
        ]),
        tableWrap,
      ]),
      el("div", { class: "card" }, [
        el("div", { class: "card-header" }, [
          el("div", { class: "card-title", text: "Department bottlenecks" }),
          el("div", { class: "card-desc", text: "Where pending requests pile up." }),
        ]),
        el("div", { class: "card-body" },
          bottlenecks.size === 0
            ? [el("div", { class: "muted sm", text: "No pending requests anywhere. 🎉" })]
            : Array.from(bottlenecks.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([name, n]) => el("div", { class: "row between sm mb-2" }, [
                  el("span", { text: name }),
                  el("span", { class: "bold tabular", text: n }),
                ])),
        ),
      ]),
    );
    wrap.append(main);
    renderRows();
    return wrap;
  };

  const exportCsv = (apps, profMap) => {
    const header = ["ID","Student","Email","Course","Batch","Status","Emergency","Created"];
    const rows = apps.map((a) => {
      const s = profMap.get(a.student_id);
      return [a.id, s?.full_name || "", s?.email || "", a.course, a.batch, a.overall_status, a.is_emergency ? "yes" : "no", new Date(a.created_at).toISOString()];
    });
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `clearance-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ---------- APPLY ----------
  const Apply = () => {
    if (App.state.role !== "student") return Pages.NotFound();
    const wrap = el("div", { style: { maxWidth: "640px" } });
    const course = el("input", { class: "input", placeholder: "B.Tech CSE" });
    const batch = el("input", { class: "input", placeholder: "2022-2026" });
    const reason = el("textarea", { class: "textarea", rows: "3", placeholder: "Optional — reason for clearance" });
    const emergency = el("input", { type: "checkbox" });
    const justification = el("textarea", { class: "textarea", rows: "2", placeholder: "Why is this urgent?" });

    if (App.state.profile?.course) course.value = App.state.profile.course;
    if (App.state.profile?.batch) batch.value = App.state.profile.batch;

    const submit = el("button", { class: "btn", text: "Submit application" });
    submit.onclick = async () => {
      if (!course.value || !batch.value) { U.toast("Course and batch are required", "error"); return; }
      submit.disabled = true; submit.innerHTML = '<span class="loader"></span>';
      try {
        await DB.createApplication({
          student_id: App.state.user.id, course: course.value, batch: batch.value,
          reason: reason.value, is_emergency: emergency.checked,
          emergency_justification: emergency.checked ? justification.value : null,
        });
        U.toast("Application submitted!", "success");
        App.navigate("/");
      } catch (e) { U.toast(e.message, "error"); submit.disabled = false; submit.textContent = "Submit application"; }
    };

    wrap.append(
      el("div", { class: "row gap-2 mb-3" }, [
        el("a", { href: "#/", class: "btn btn-ghost btn-sm", html: U.icon("back") + " <span>Back</span>" }),
      ]),
      el("div", { class: "h1 mb-2", text: "New clearance application" }),
      el("div", { class: "muted sm mb-4", text: "We'll route your request to every active department." }),
      el("div", { class: "card" }, [
        el("div", { class: "card-body" }, [
          el("div", { class: "field" }, [el("label", { class: "label", text: "Course" }), course]),
          el("div", { class: "field" }, [el("label", { class: "label", text: "Batch" }), batch]),
          el("div", { class: "field" }, [el("label", { class: "label", text: "Reason (optional)" }), reason]),
          el("div", { class: "field row gap-2" }, [emergency, el("label", { class: "label", style: { margin: 0 }, text: "Mark as emergency" })]),
          el("div", { class: "field" }, [el("label", { class: "label", text: "Emergency justification" }), justification]),
          el("div", { class: "row gap-2 mt-2" }, [submit, el("a", { class: "btn btn-outline", href: "#/", text: "Cancel" })]),
        ]),
      ]),
    );
    return wrap;
  };

  // ---------- NOTIFICATIONS ----------
  const Notifications = async () => {
    const wrap = el("div");
    const list = await DB.myNotifications(App.state.user.id);
    wrap.append(
      el("div", { class: "h1 mb-3", text: "Notifications" }),
      el("div", { class: "card" }, [
        el("div", { class: "card-body" },
          list.length === 0
            ? [el("div", { class: "dashed-empty", text: "No notifications yet." })]
            : list.map((n) => el("div", { class: "list-row mb-2", style: { flexDirection: "column", alignItems: "stretch", opacity: n.read ? 0.65 : 1 } }, [
                el("div", { class: "row between" }, [
                  el("div", { class: "bold sm", text: n.title }),
                  el("span", { class: "xs muted", text: U.fmtDate(n.created_at) }),
                ]),
                el("div", { class: "xs muted mt-1", text: n.body || "" }),
                !n.read ? el("button", { class: "btn btn-outline btn-sm mt-2", text: "Mark as read",
                  onClick: async () => { await DB.markNotifRead(n.id); App.render(); }}) : null,
              ])),
        ),
      ]),
    );
    return wrap;
  };

  // ---------- ADMIN: STUDENTS LIST ----------
  const AdminStudents = async () => {
    const wrap = el("div");
    const profiles = await DB.listProfiles();
    const roles = await DB.listRoles();
    const apps = await DB.allApplications();
    const depts = await DB.listDepartments();
    const roleByUser = new Map(roles.map((r) => [r.user_id, r]));
    const appCount = new Map();
    apps.forEach((a) => appCount.set(a.student_id, (appCount.get(a.student_id) || 0) + 1));

    wrap.append(
      el("div", { class: "h1 mb-2", text: "Students & Users" }),
      el("div", { class: "muted sm mb-4", text: "Promote users, assign departments, or open a profile." }),
    );

    const tableCard = el("div", { class: "card" });
    const body = el("div", { class: "scroll-x" });
    const table = el("table");
    table.append(
      el("thead", {}, [el("tr", {}, [
        el("th", { text: "Name" }), el("th", { text: "Email" }),
        el("th", { text: "Role" }), el("th", { text: "Apps" }),
        el("th", { text: "Actions" }),
      ])]),
    );
    const tbody = el("tbody");
    profiles.forEach((p) => {
      const r = roleByUser.get(p.id);
      const dept = r?.department_id ? depts.find((d) => d.id === r.department_id) : null;
      tbody.append(el("tr", {}, [
        el("td", { html: `<a href="#/admin/students/${p.id}" class="bold">${p.full_name || "—"}</a>` }),
        el("td", { class: "muted", text: p.email }),
        el("td", {}, [el("span", { class: "pill", text: (r?.role || "student") + (dept ? " · " + dept.name : "") })]),
        el("td", { class: "tabular", text: String(appCount.get(p.id) || 0) }),
        el("td", {}, [
          el("button", { class: "btn btn-outline btn-sm", text: "Change role",
            onClick: () => openRoleEditor(p, r, depts) }),
        ]),
      ]));
    });
    table.append(tbody);
    body.append(table);
    tableCard.append(body);
    wrap.append(tableCard);
    return wrap;
  };

  const openRoleEditor = (profile, currentRole, depts) => {
    const sel = el("select", { class: "select" }, [
      el("option", { value: "student", text: "Student" }),
      el("option", { value: "dept_admin", text: "Department Admin" }),
      el("option", { value: "master_admin", text: "Master Admin" }),
    ]);
    sel.value = currentRole?.role || "student";
    const deptSel = el("select", { class: "select" }, [
      el("option", { value: "", text: "— Select department —" }),
      ...depts.map((d) => el("option", { value: d.id, text: d.name })),
    ]);
    if (currentRole?.department_id) deptSel.value = currentRole.department_id;

    const update = () => { deptSel.style.display = sel.value === "dept_admin" ? "" : "none"; };
    sel.onchange = update; update();

    const save = el("button", { class: "btn", text: "Save role" });
    const cancel = el("button", { class: "btn btn-outline", text: "Cancel" });
    const m = U.modal({
      title: "Change role · " + (profile.full_name || profile.email),
      body: el("div", {}, [
        el("div", { class: "field" }, [el("label", { class: "label", text: "Role" }), sel]),
        el("div", { class: "field" }, [el("label", { class: "label", text: "Department (for dept admin)" }), deptSel]),
      ]),
      footer: [cancel, save],
    });
    cancel.onclick = () => m.close();
    save.onclick = async () => {
      try {
        await DB.setUserRole(profile.id, sel.value, sel.value === "dept_admin" ? deptSel.value || null : null);
        U.toast("Role updated", "success");
        m.close(); App.render();
      } catch (e) { U.toast(e.message, "error"); }
    };
  };

  // ---------- ADMIN: STUDENT DETAIL ----------
  const StudentDetail = async (id) => {
    const wrap = el("div", { style: { maxWidth: "1000px" } });
    const profile = await DB.getProfile(id);
    const apps = (await DB.allApplications()).filter((a) => a.student_id === id);
    const depts = await DB.listDepartments();
    const deptMap = new Map(depts.map((d) => [d.id, d]));

    wrap.append(
      el("div", { class: "row gap-2 mb-3" }, [
        el("a", { href: "#/", class: "btn btn-ghost btn-sm", html: U.icon("back") + " <span>Back</span>" }),
      ]),
      el("div", { class: "h1", text: profile?.full_name || "Student" }),
      el("div", { class: "muted sm mb-4", text: profile?.email || "" }),
    );

    if (!apps.length) {
      wrap.append(el("div", { class: "dashed-empty", text: "No applications yet." }));
      return wrap;
    }

    for (const app of apps) {
      const statuses = await DB.statusesForApp(app.id);
      const docs = await DB.listDocuments(app.id);
      const audit = await DB.auditForApp(app.id);

      const card = el("div", { class: "card mb-3" });
      card.append(
        el("div", { class: "card-header" }, [
          el("div", { class: "row between wrap" }, [
            el("div", {}, [
              el("div", { class: "row gap-2 card-title" }, [
                el("span", { text: `${app.course} · ${app.batch}` }),
                app.is_emergency ? U.statusBadge("emergency") : null,
              ]),
              el("div", { class: "card-desc", text: "Submitted " + U.fmtDate(app.created_at) }),
            ]),
            el("div", { class: "row gap-2" }, [
              U.statusBadge(app.overall_status),
              el("button", { class: "btn btn-sm", disabled: app.overall_status !== "completed",
                html: U.icon("download") + " <span>Certificate</span>",
                onClick: () => Cert.openCertificate(app, profile, depts) }),
            ]),
          ]),
        ]),
      );

      // Department grid with master override
      const grid = el("div", { class: "grid grid-2", style: { padding: "12px 18px" } });
      statuses.forEach((s) => {
        const dept = deptMap.get(s.department_id);
        grid.append(el("div", { class: "list-row", style: { flexDirection: "column", alignItems: "stretch" } }, [
          el("div", { class: "row between" }, [
            el("div", { class: "bold sm", text: dept?.name || "—" }),
            U.statusBadge(s.status),
          ]),
          s.comments ? el("div", { class: "xs mt-1 muted", text: s.comments }) : null,
          el("div", { class: "row gap-2 mt-2" }, [
            el("button", { class: "btn btn-outline btn-sm", html: U.icon("check") + " <span>Approve</span>",
              onClick: async () => { await DB.overrideStatus(s.id, "approved", "Master override", App.state.user.id); U.toast("Approved", "success"); App.render(); }}),
            el("button", { class: "btn btn-outline btn-sm", html: U.icon("x") + " <span>Deny</span>",
              onClick: async () => {
                const c = await U.promptDialog("Reason for denial?"); if (!c) return;
                await DB.overrideStatus(s.id, "denied", c, App.state.user.id);
                U.toast("Denied", "info"); App.render();
              }}),
          ]),
        ]));
      });
      card.append(grid);

      // Documents
      if (docs.length) {
        card.append(el("div", { class: "card-row" }, [
          el("div", { class: "kbd-section-title", text: "Documents" }),
          el("ul", { style: { paddingLeft: "16px", margin: 0 } },
            docs.map((d) => el("li", { class: "sm" }, [
              d.data_url
                ? el("a", { href: d.data_url, target: "_blank", text: d.file_name })
                : document.createTextNode(d.file_name),
              document.createTextNode(` (${Math.round((d.size_bytes || 0) / 1024)} KB)`),
            ]))),
        ]));
      }

      // Timeline
      card.append(el("div", { class: "card-row" }, [
        el("div", { class: "kbd-section-title", text: "Audit timeline" }),
        audit.length === 0
          ? el("div", { class: "muted sm", text: "No actions yet." })
          : el("div", { class: "timeline mt-2" },
              audit.map((a) => {
                const dn = deptMap.get(a.department_id)?.name || "—";
                const cls = a.action.includes("approved") ? "approved"
                  : a.action.includes("denied") ? "denied" : "pending";
                return el("div", { class: "timeline-item " + cls }, [
                  el("div", { class: "sm bold", text: a.action.replace(/_/g, " ") + " · " + dn }),
                  el("div", { class: "xs muted", text: U.fmtDate(a.created_at) }),
                  a.comments ? el("div", { class: "xs mt-1", text: a.comments }) : null,
                ]);
              })),
      ]));

      wrap.append(card);
    }
    return wrap;
  };

  // ---------- ADMIN: DEPARTMENTS ----------
  const AdminDepartments = async () => {
    const wrap = el("div", { style: { maxWidth: "800px" } });
    const depts = await DB.listDepartments();
    const name = el("input", { class: "input", placeholder: "Department name" });
    const desc = el("input", { class: "input", placeholder: "Description (optional)" });
    const add = el("button", { class: "btn", html: U.icon("plus") + " <span>Add</span>" });
    add.onclick = async () => {
      if (!name.value) return U.toast("Name required", "error");
      await DB.addDepartment({ name: name.value, description: desc.value });
      U.toast("Added", "success"); App.render();
    };

    wrap.append(
      el("div", { class: "h1 mb-2", text: "Departments" }),
      el("div", { class: "muted sm mb-4", text: "Configure which departments take part in clearance." }),
      el("div", { class: "card mb-4" }, [
        el("div", { class: "card-body row gap-2" }, [name, desc, add]),
      ]),
      el("div", { class: "card" }, [
        el("div", { class: "card-body" },
          depts.map((d) => el("div", { class: "list-row mb-2" }, [
            el("div", {}, [
              el("div", { class: "bold sm", text: d.name }),
              el("div", { class: "xs muted", text: d.description || "" }),
            ]),
            el("div", { class: "row gap-2" }, [
              el("button", { class: "btn btn-outline btn-sm", text: d.active ? "Disable" : "Enable",
                onClick: async () => { await DB.toggleDepartment(d.id, !d.active); U.toast("Updated", "success"); App.render(); }}),
              el("button", { class: "btn btn-outline btn-sm", html: U.icon("trash"),
                onClick: async () => {
                  if (!await U.confirmDialog("Delete this department? Existing clearance steps will keep their snapshot.")) return;
                  try { await DB.deleteDepartment(d.id); U.toast("Deleted", "success"); App.render(); }
                  catch (e) { U.toast(e.message, "error"); }
                }}),
            ]),
          ])),
        ),
      ]),
    );
    return wrap;
  };

  // ---------- ANALYTICS ----------
  const Analytics = async () => {
    const wrap = el("div");
    const apps = await DB.allApplications();
    const depts = await DB.listDepartments();

    // Status distribution
    const statusCounts = { in_progress: 0, action_required: 0, completed: 0, not_started: 0 };
    apps.forEach((a) => statusCounts[a.overall_status] = (statusCounts[a.overall_status] || 0) + 1);

    // Per-dept approve/deny/pending
    const deptStats = depts.map((d) => ({ name: d.name, approved: 0, denied: 0, pending: 0 }));
    for (const a of apps) {
      const ss = await DB.statusesForApp(a.id);
      ss.forEach((s) => {
        const r = deptStats.find((x) => x.name === depts.find((d) => d.id === s.department_id)?.name);
        if (r) r[s.status] = (r[s.status] || 0) + 1;
      });
    }

    // Avg approval time per dept (across audit_log "approved" actions)
    const timesByDept = {};
    for (const a of apps) {
      const audit = await DB.auditForApp(a.id);
      audit.filter((x) => x.action === "approved").forEach((x) => {
        const dn = depts.find((d) => d.id === x.department_id)?.name || "—";
        const t = (new Date(x.created_at) - new Date(a.created_at)) / 36e5; // hours
        (timesByDept[dn] = timesByDept[dn] || []).push(t);
      });
    }
    const avgTime = Object.entries(timesByDept).map(([n, arr]) => ({ name: n, avg: arr.reduce((x, y) => x + y, 0) / arr.length }));

    wrap.append(
      el("div", { class: "h1 mb-2", text: "Analytics" }),
      el("div", { class: "muted sm mb-4", text: "Throughput, status distribution, and approval times." }),
      el("div", { class: "grid grid-2" }, [
        chartCard("Status distribution", (canvas) => new Chart(canvas, {
          type: "doughnut",
          data: { labels: Object.keys(statusCounts), datasets: [{ data: Object.values(statusCounts),
            backgroundColor: ["#f59e0b", "#ef4444", "#10b981", "#9ca3af"] }] },
          options: { plugins: { legend: { position: "bottom" } } },
        })),
        chartCard("Avg approval time (hours)", (canvas) => new Chart(canvas, {
          type: "bar",
          data: { labels: avgTime.map((x) => x.name), datasets: [{ data: avgTime.map((x) => +x.avg.toFixed(2)),
            backgroundColor: "#3b82f6" }] },
          options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
        })),
      ]),
      el("div", { class: "mt-4" }, [
        chartCard("Per-department breakdown", (canvas) => new Chart(canvas, {
          type: "bar",
          data: { labels: deptStats.map((d) => d.name),
            datasets: [
              { label: "Approved", data: deptStats.map((d) => d.approved), backgroundColor: "#10b981" },
              { label: "Pending",  data: deptStats.map((d) => d.pending),  backgroundColor: "#f59e0b" },
              { label: "Denied",   data: deptStats.map((d) => d.denied),   backgroundColor: "#ef4444" },
            ]},
          options: { plugins: { legend: { position: "bottom" } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } },
        })),
      ]),
    );
    return wrap;
  };

  const chartCard = (title, build) => {
    const canvas = el("canvas", { height: "240" });
    const card = el("div", { class: "card" }, [
      el("div", { class: "card-header" }, [el("div", { class: "card-title", text: title })]),
      el("div", { class: "card-body", style: { height: "300px" } }, [canvas]),
    ]);
    setTimeout(() => { try { build(canvas); } catch (e) { console.error(e); } }, 30);
    return card;
  };

  // ---------- PROFILE ----------
  const Profile = async () => {
    const wrap = el("div", { style: { maxWidth: "560px" } });
    const p = App.state.profile || {};
    const fullName = el("input", { class: "input", value: p.full_name || "" });
    const studentId = el("input", { class: "input", value: p.student_id || "" });
    const course = el("input", { class: "input", value: p.course || "" });
    const batch = el("input", { class: "input", value: p.batch || "" });
    const save = el("button", { class: "btn", text: "Save profile" });
    save.onclick = async () => {
      try {
        await DB.updateProfile(App.state.user.id, {
          full_name: fullName.value, student_id: studentId.value || null,
          course: course.value || null, batch: batch.value || null,
        });
        await App.loadAuth(); U.toast("Saved", "success"); App.render();
      } catch (e) { U.toast(e.message, "error"); }
    };
    wrap.append(
      el("div", { class: "h1 mb-2", text: "Your profile" }),
      el("div", { class: "muted sm mb-4", text: App.state.user?.email + " · " + App.state.role }),
      el("div", { class: "card" }, [
        el("div", { class: "card-body" }, [
          el("div", { class: "field" }, [el("label", { class: "label", text: "Full name" }), fullName]),
          el("div", { class: "field" }, [el("label", { class: "label", text: "Student ID" }), studentId]),
          el("div", { class: "field" }, [el("label", { class: "label", text: "Course" }), course]),
          el("div", { class: "field" }, [el("label", { class: "label", text: "Batch" }), batch]),
          save,
        ]),
      ]),
      DB.mode === "local" ? el("div", { class: "mt-4 card" }, [
        el("div", { class: "card-header" }, [el("div", { class: "card-title", text: "Local data tools" })]),
        el("div", { class: "card-body row gap-2" }, [
          el("button", { class: "btn btn-outline btn-sm", text: "Seed demo users + apps",
            onClick: async () => { await DB._seedDemoData(); App.render(); }}),
          el("button", { class: "btn btn-outline btn-sm", text: "Wipe local data",
            onClick: async () => {
              if (!await U.confirmDialog("Erase all local clearance data?")) return;
              await DB._resetLocal(); location.reload();
            }}),
        ]),
      ]) : null,
    );
    return wrap;
  };

  // ---------- 404 ----------
  const NotFound = () => el("div", { class: "dashed-empty" }, [
    el("div", { class: "h2 mb-2", text: "Page not found" }),
    el("a", { href: "#/", class: "btn", text: "Back home" }),
  ]);

  // ---------- helpers ----------
  const statCard = (iconName, label, value, tone) =>
    el("div", { class: "card" }, [el("div", { class: "stat" + (tone === "danger" ? " danger" : "") }, [
      el("div", { class: "ico", html: U.icon(iconName) }),
      el("div", {}, [el("div", { class: "lbl", text: label }), el("div", { class: "val", text: String(value) })]),
    ])]);

  return { Auth, Dashboard, Apply, Notifications, AdminStudents, StudentDetail, AdminDepartments, Analytics, Profile, NotFound };
})();
