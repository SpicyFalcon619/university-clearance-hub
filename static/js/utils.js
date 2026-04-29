// Tiny DOM/utility helpers (no framework)
window.U = (() => {
  const el = (tag, attrs = {}, children = []) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "html") e.innerHTML = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
      else e.setAttribute(k, v);
    }
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c == null || c === false) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  };
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const uid = () =>
    (crypto.randomUUID && crypto.randomUUID()) ||
    "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);

  const fmtDate = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    return dt.toLocaleString();
  };
  const fmtDateShort = (d) => (d ? new Date(d).toLocaleDateString() : "");

  // Toast
  let wrap;
  const toast = (msg, kind = "info") => {
    if (!wrap) {
      wrap = el("div", { class: "toast-wrap" });
      document.body.appendChild(wrap);
    }
    const t = el("div", { class: `toast ${kind}`, text: msg });
    wrap.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  };

  // Modal
  const modal = ({ title, body, footer, onClose }) => {
    const back = el("div", { class: "modal-back" });
    const close = () => { back.remove(); onClose && onClose(); };
    const m = el("div", { class: "modal" }, [
      el("div", { class: "modal-header" }, [
        el("div", { class: "card-title", text: title || "" }),
        el("button", { class: "icon-btn", onClick: close, html: "✕" }),
      ]),
      el("div", { class: "modal-body" }, body || []),
      footer && el("div", { class: "modal-footer" }, footer),
    ]);
    back.appendChild(m);
    back.addEventListener("click", (e) => { if (e.target === back) close(); });
    document.body.appendChild(back);
    return { close };
  };

  // Confirm
  const confirmDialog = (msg) =>
    new Promise((resolve) => {
      const cancel = el("button", { class: "btn btn-outline", text: "Cancel" });
      const ok = el("button", { class: "btn", text: "Confirm" });
      const m = modal({
        title: "Are you sure?",
        body: el("p", { class: "sm muted", text: msg }),
        footer: [cancel, ok],
        onClose: () => resolve(false),
      });
      cancel.onclick = () => { m.close(); resolve(false); };
      ok.onclick = () => { m.close(); resolve(true); };
    });

  // Prompt
  const promptDialog = (msg, placeholder = "") =>
    new Promise((resolve) => {
      const ta = el("textarea", { class: "textarea", placeholder, rows: "3" });
      const cancel = el("button", { class: "btn btn-outline", text: "Cancel" });
      const ok = el("button", { class: "btn", text: "Submit" });
      const m = modal({
        title: msg,
        body: ta,
        footer: [cancel, ok],
        onClose: () => resolve(null),
      });
      cancel.onclick = () => { m.close(); resolve(null); };
      ok.onclick = () => { const v = ta.value.trim(); m.close(); resolve(v); };
      setTimeout(() => ta.focus(), 50);
    });

  // Status badge element
  const statusBadge = (status) => {
    const map = {
      approved: { l: "Approved", i: "✓" },
      completed: { l: "Completed", i: "✓" },
      pending: { l: "Pending", i: "⏱" },
      in_progress: { l: "In Progress", i: "⏱" },
      not_started: { l: "Not Started", i: "○" },
      denied: { l: "Denied", i: "✕" },
      action_required: { l: "Action Required", i: "!" },
      emergency: { l: "Urgent", i: "⚡" },
    };
    const m = map[status] || { l: status, i: "•" };
    return el("span", {
      class: `status-badge s-${status}`,
      html: `<span aria-hidden="true">${m.i}</span> ${m.l}`,
    });
  };

  // Icon (inline svg from feather-like)
  const icon = (name) => {
    const icons = {
      home: '<path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/>',
      file: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>',
      bell: '<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/>',
      users: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13A4 4 0 0116 11"/>',
      shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
      grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
      logout: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
      moon: '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>',
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
      menu: '<path d="M3 12h18M3 6h18M3 18h18"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      download: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
      back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
      check: '<path d="M20 6L9 17l-5-5"/>',
      x: '<path d="M18 6L6 18M6 6l12 12"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
      file_check: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M9 14l2 2 4-4"/>',
      clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
      alert: '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
      chart: '<path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/>',
      upload: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
      trash: '<path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>',
    };
    return `<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[name] || ""}</svg>`;
  };

  // Theme
  const setTheme = (mode) => {
    document.documentElement.classList.toggle("dark", mode === "dark");
    localStorage.setItem("ocs.theme", mode);
  };
  const initTheme = () => {
    const saved = localStorage.getItem("ocs.theme");
    if (saved) setTheme(saved);
    else if (matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");
  };

  // Generate client-side certificate ref
  const certRef = (appId) => `CL-${new Date().getFullYear()}-${appId.slice(0, 8).toUpperCase()}`;

  return { el, $, $$, uid, fmtDate, fmtDateShort, toast, modal, confirmDialog, promptDialog, statusBadge, icon, setTheme, initTheme, certRef };
})();
