// ============================================================
// AppShell, Router, AuthContext (vanilla)
// ============================================================
window.App = (() => {
  const state = {
    user: null,
    role: null,         // 'student' | 'dept_admin' | 'master_admin'
    department_id: null,
    profile: null,
    notifications: [],
    sidebarOpen: false,
  };
  const listeners = new Set();
  const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  const emit = () => listeners.forEach((fn) => fn(state));

  const loadAuth = async () => {
    const u = await DB.getCurrentUser();
    if (!u) { state.user = null; state.role = null; state.profile = null; return; }
    state.user = u;
    const r = await DB.getRole(u.id);
    state.role = r.role;
    state.department_id = r.department_id;
    state.profile = await DB.getProfile(u.id);
    state.notifications = state.role === "student" ? await DB.myNotifications(u.id) : [];
  };

  const route = () => {
    const hash = location.hash.replace(/^#/, "") || "/";
    return hash;
  };
  const navigate = (path) => { location.hash = path; };

  // Renders the entire shell + current page
  const render = async () => {
    const root = document.getElementById("root");
    root.innerHTML = "";
    if (!state.user) {
      root.appendChild(Pages.Auth());
      return;
    }
    root.appendChild(buildShell());
  };

  const buildShell = () => {
    const path = route();
    const wrap = U.el("div", { class: "app-shell" });
    wrap.appendChild(buildSidebar(path));

    const main = U.el("div", {});
    main.appendChild(buildTopbar());
    const content = U.el("main", { class: "main", id: "main-content" });

    // Route resolver
    let page;
    try {
      if (path === "/" || path === "") page = Pages.Dashboard();
      else if (path === "/apply") page = Pages.Apply();
      else if (path === "/notifications") page = Pages.Notifications();
      else if (path === "/admin/students") page = Pages.AdminStudents();
      else if (path.startsWith("/admin/students/")) page = Pages.StudentDetail(path.split("/").pop());
      else if (path === "/admin/departments") page = Pages.AdminDepartments();
      else if (path === "/admin/analytics") page = Pages.Analytics();
      else if (path === "/profile") page = Pages.Profile();
      else page = Pages.NotFound();
    } catch (e) {
      console.error(e);
      page = U.el("div", { class: "card" }, [U.el("div", { class: "card-body", text: "Something went wrong: " + e.message })]);
    }
    if (page instanceof Promise) {
      content.appendChild(U.el("div", { class: "center-screen" }, [U.el("span", { class: "loader" })]));
      page.then((node) => { content.innerHTML = ""; content.appendChild(node); });
    } else {
      content.appendChild(page);
    }
    main.appendChild(content);
    wrap.appendChild(main);
    return wrap;
  };

  const buildTopbar = () => {
    const burger = U.el("button", { class: "icon-btn", html: U.icon("menu"), onClick: () => {
      state.sidebarOpen = !state.sidebarOpen;
      document.querySelector(".sidebar")?.classList.toggle("open", state.sidebarOpen);
    }});
    return U.el("div", { class: "topbar" }, [
      burger,
      U.el("div", { class: "row gap-2", html: `<div class="logo" style="width:24px;height:24px;border-radius:6px;background:hsl(224 76% 56%);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">CL</div><strong>Clearance</strong>` }),
      themeToggleBtn(),
    ]);
  };

  const themeToggleBtn = () => {
    const isDark = document.documentElement.classList.contains("dark");
    const btn = U.el("button", {
      class: "icon-btn",
      title: "Toggle theme",
      html: isDark ? U.icon("sun") : U.icon("moon"),
      onClick: () => {
        const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
        U.setTheme(next);
        render();
      },
    });
    return btn;
  };

  const buildSidebar = (currentPath) => {
    const nav = (path, iconName, label) =>
      U.el("a", {
        href: "#" + path,
        class: "nav-link" + (currentPath === path || (path !== "/" && currentPath.startsWith(path)) ? " active" : ""),
        html: U.icon(iconName) + `<span>${label}</span>`,
      });
    const links = [];
    links.push(nav("/", "home", "Dashboard"));
    if (state.role === "student") {
      links.push(nav("/apply", "file", "New application"));
      links.push(nav("/notifications", "bell",
        `Notifications${state.notifications.filter((n) => !n.read).length ? " ●" : ""}`));
    }
    if (state.role === "master_admin") {
      links.push(nav("/admin/students", "users", "Students"));
      links.push(nav("/admin/departments", "grid", "Departments"));
      links.push(nav("/admin/analytics", "chart", "Analytics"));
    }
    links.push(nav("/profile", "shield", "Profile"));

    const userBox = U.el("div", { class: "userbox" }, [
      U.el("strong", { text: state.profile?.full_name || state.user?.email || "User" }),
      U.el("div", { text: state.user?.email || "" }),
      U.el("div", { class: "mt-2", html: `<span class="pill">${state.role || "student"}</span>` }),
      U.el("button", {
        class: "btn btn-outline btn-sm mt-3",
        html: U.icon("logout") + " <span>Sign out</span>",
        onClick: async () => { await DB.signOut(); await loadAuth(); render(); },
      }),
      U.el("div", { class: "mt-3 row gap-2" }, [
        themeToggleBtn(),
        DB.mode === "local" ? U.el("button", {
          class: "icon-btn", title: "Seed demo data", html: U.icon("plus"),
          onClick: async () => { await DB._seedDemoData(); render(); },
        }) : null,
      ]),
    ]);

    const sb = U.el("aside", { class: "sidebar" + (state.sidebarOpen ? " open" : "") }, [
      U.el("div", { class: "brand" }, [
        U.el("div", { class: "logo", text: "CL" }),
        U.el("span", { text: "Clearance" }),
      ]),
      ...links,
      U.el("div", { class: "spacer" }),
      userBox,
    ]);
    return sb;
  };

  const init = async () => {
    U.initTheme();
    await loadAuth();
    render();
    window.addEventListener("hashchange", render);
    if (DB.mode === "cloud" && DB.supa) {
      DB.supa.auth.onAuthStateChange(async (_evt) => {
        await loadAuth();
        render();
      });
    }
  };

  return { state, init, render, navigate, loadAuth, subscribe };
})();
