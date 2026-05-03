/* =====================================================================
   UIU ClearPath — shared client helpers (toast, fetch, dom, theme)
   ===================================================================== */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

// ---- API root: all endpoints live under ../api/* relative to /public/
export const API = "../api";

export async function api(path, { method = "GET", body, form } = {}) {
  const opts = { method, credentials: "same-origin", headers: {} };
  if (form) {
    opts.body = form;
  } else if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API}/${path}`, opts);
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ---- Toast --------------------------------------------------------------
function toastHost() {
  let h = document.querySelector(".toast-host");
  if (!h) { h = document.createElement("div"); h.className = "toast-host"; document.body.appendChild(h); }
  return h;
}
export function toast(msg, kind = "") {
  const t = document.createElement("div");
  t.className = `toast ${kind}`;
  t.textContent = msg;
  toastHost().appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .25s"; }, 2700);
  setTimeout(() => t.remove(), 3000);
}

// ---- Theme --------------------------------------------------------------
export function initTheme() {
  const saved = localStorage.getItem("theme") ||
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", saved);
}
export function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", cur);
  localStorage.setItem("theme", cur);
}

// ---- Status helpers -----------------------------------------------------
export const STATUS_BADGE = {
  approved:        { cls: "b-ok",      label: "Approved" },
  denied:          { cls: "b-err",     label: "Denied" },
  pending:         { cls: "b-pending", label: "Pending" },
  in_progress:     { cls: "b-pending", label: "In Progress" },
  action_required: { cls: "b-err",     label: "Action Required" },
  completed:       { cls: "b-ok",      label: "Completed" },
  not_started:     { cls: "b-neutral", label: "Not Started" },
  emergency:       { cls: "b-emer",    label: "Urgent" },
};
export const badgeHtml = (status) => {
  const b = STATUS_BADGE[status] || { cls: "b-neutral", label: status };
  return `<span class="badge ${b.cls}">${b.label}</span>`;
};

// ---- Modal --------------------------------------------------------------
export function openModal(html) {
  const back = document.createElement("div");
  back.className = "modal-back";
  back.innerHTML = `<div class="modal">${html}</div>`;
  document.body.appendChild(back);
  back.addEventListener("click", (e) => { if (e.target === back) close(); });
  function close() { back.remove(); }
  return { el: back.querySelector(".modal"), close };
}

// ---- Auth gate (redirect to /public/auth.html if not logged in) ---------
export async function requireAuth(allowedRoles) {
  try {
    const me = await api("auth.php?action=me");
    if (!me.user) { location.href = "auth.html"; return null; }
    if (allowedRoles && !allowedRoles.includes(me.user.role)) {
      location.href = "index.html"; return null;
    }
    return me;
  } catch {
    location.href = "auth.html";
    return null;
  }
}

// ---- Animated tab bar ---------------------------------------------------
export function buildTabs(items, currentPath) {
  // items: [{href, label, icon}]
  const bar = document.createElement("nav");
  bar.className = "tabbar";
  bar.innerHTML = `<span class="tab-indicator" hidden></span>` + items.map(i =>
    `<a href="${i.href}" data-href="${i.href}" class="${i.href === currentPath ? "active" : ""}">
       <span>${i.icon || ""}</span><span>${i.label}</span>
     </a>`).join("");
  // Position the indicator under the active tab (run after attached).
  requestAnimationFrame(() => positionIndicator(bar));
  window.addEventListener("resize", () => positionIndicator(bar));
  return bar;
}
function positionIndicator(bar) {
  const ind = bar.querySelector(".tab-indicator");
  const a   = bar.querySelector("a.active");
  if (!ind || !a) { if (ind) ind.hidden = true; return; }
  const br = bar.getBoundingClientRect();
  const ar = a.getBoundingClientRect();
  ind.hidden = false;
  ind.style.left  = (ar.left - br.left) + "px";
  ind.style.width = ar.width + "px";
}

// ---- App shell (header + nav) ------------------------------------------
export function mountShell(me, currentPath) {
  initTheme();
  const role = me.user.role;
  const nav = role === "master_admin"
    ? [{ href: "admin.html",        label: "Overview",    icon: "📊" },
       { href: "users.html",        label: "Users",       icon: "👥" },
       { href: "departments.html",  label: "Departments", icon: "🏢" }]
    : role === "dept_admin"
    ? [{ href: "department.html",   label: "Queue",       icon: "📥" }]
    : [{ href: "index.html",        label: "Dashboard",   icon: "📋" },
       { href: "apply.html",        label: "New Application", icon: "📝" }];

  const header = document.createElement("header");
  header.className = "header";
  header.innerHTML = `
    <div class="header-inner">
      <div class="flex center" style="gap:2rem">
        <a class="logo" href="index.html">
          <span class="logo-mark">🎓</span>
          <span>UIU <span class="brand-text">ClearPath</span></span>
        </a>
        <span id="navslot"></span>
      </div>
      <div class="header-actions">
        ${role === "student"
          ? `<a class="icon-btn" href="notifications.html" title="Notifications">🔔</a>` : ""}
        <button class="icon-btn" id="themeBtn" title="Toggle theme">🌓</button>
        <span class="email">${escapeHtml(me.user.email)}</span>
        <button class="icon-btn" id="logoutBtn" title="Sign out">⎋</button>
      </div>
    </div>`;
  document.body.prepend(header);
  header.querySelector("#navslot").appendChild(buildTabs(nav, currentPath));
  header.querySelector("#themeBtn").onclick = toggleTheme;
  header.querySelector("#logoutBtn").onclick = async () => {
    await api("auth.php?action=logout", { method: "POST" });
    location.href = "auth.html";
  };
}
