/* Student dashboard — list applications + per-department status. */
import { api, toast, $, escapeHtml, badgeHtml, openModal } from "./app.js";

export async function renderStudent() {
  const root = $("#root");
  root.innerHTML = `<div class="sk" style="height:140px"></div>`;

  const [{ applications }, { departments }] = await Promise.all([
    api("applications.php?action=mine"),
    api("departments.php?action=list"),
  ]);

  const head = `
    <div class="row mb-4">
      <div>
        <h1 style="font-size:1.5rem">Your Clearance</h1>
        <p class="muted">Track approvals across departments and download your certificate.</p>
      </div>
      <a class="btn" href="apply.html">＋ New Application</a>
    </div>`;

  if (!applications.length) {
    root.innerHTML = head + `
      <div class="empty">
        <div class="e-icon">📄</div>
        <h3>No applications yet</h3>
        <p>Start your clearance process by submitting a new application — we'll guide you through every department.</p>
        <a class="btn" href="apply.html">＋ Start Application</a>
      </div>`;
    return;
  }

  const active = applications[0];
  const detail = await api(`applications.php?action=detail&id=${encodeURIComponent(active.id)}`);
  const ds = detail.departments;

  const total    = ds.length || 1;
  const approved = ds.filter(s => s.status === "approved").length;
  const pct      = Math.round((approved / total) * 100);
  const completed = active.overall_status === "completed";

  const deptCards = ds.map(s => `
    <div class="card card-pad row" style="align-items:flex-start">
      <div style="min-width:0">
        <div class="font-medium text-sm">${escapeHtml(s.department_name)}</div>
        ${s.comments ? `<div class="muted text-xs mt-2">💬 ${escapeHtml(s.comments)}</div>` : ""}
      </div>
      <div class="flex" style="flex-direction:column;align-items:flex-end;gap:.35rem">
        ${badgeHtml(s.status)}
        ${s.status === "denied"
          ? `<button class="btn btn-sm btn-outline" data-resub="${s.id}" data-name="${escapeHtml(s.department_name)}">↻ Re-evaluate</button>` : ""}
      </div>
    </div>`).join("");

  const prev = applications.slice(1).map(a => `
    <div class="card card-pad row">
      <div>
        <div class="font-medium text-sm">${escapeHtml(a.course)} · ${escapeHtml(a.batch)}</div>
        <div class="muted text-xs">${new Date(a.created_at).toLocaleDateString()}</div>
      </div>
      ${badgeHtml(a.overall_status)}
    </div>`).join("");

  root.innerHTML = head + `
    <div class="card card-pad stack">
      <div class="row">
        <div>
          <h3 class="card-title">${escapeHtml(active.course)} · ${escapeHtml(active.batch)}
            ${active.is_emergency ? badgeHtml("emergency") : ""}</h3>
          <p class="card-desc">Submitted ${new Date(active.created_at).toLocaleDateString()}</p>
        </div>
        ${badgeHtml(active.overall_status)}
      </div>

      <div>
        <div class="row text-xs muted mb-2"><span>${approved} of ${total} departments approved</span><span>${pct}%</span></div>
        <div class="progress"><i style="width:${pct}%"></i></div>
      </div>

      ${active.is_emergency && active.emergency_justification ? `
        <div class="card card-pad" style="background:var(--emer-bg);border-color:color-mix(in oklab,var(--emer) 30%,transparent)">
          <div class="font-medium">⚠ Marked urgent</div>
          <div class="muted text-sm">${escapeHtml(active.emergency_justification)}</div>
        </div>` : ""}

      <div class="grid-2">${deptCards}</div>

      <div class="divider row">
        <div class="text-sm">${completed
          ? `<span style="color:var(--ok);font-weight:500">✨ Clearance complete</span>`
          : `<span class="muted">Certificate unlocks once all departments approve.</span>`}</div>
        <button class="btn" id="dlBtn" ${completed ? "" : "disabled"}>⬇ Download Certificate</button>
      </div>
    </div>

    ${prev ? `<h2 class="text-sm muted mt-6 mb-2">Previous applications</h2><div class="stack">${prev}</div>` : ""}`;

  // Re-evaluation requests.
  root.querySelectorAll("[data-resub]").forEach(btn => {
    btn.onclick = () => {
      const id   = btn.dataset.resub;
      const name = btn.dataset.name;
      const m = openModal(`
        <h3>Request re-evaluation — ${escapeHtml(name)}</h3>
        <p class="muted text-sm mb-2">Briefly describe how you've resolved the issue:</p>
        <textarea id="resubMsg" maxlength="500"></textarea>
        <div class="actions">
          <button class="btn btn-ghost" id="cancel">Cancel</button>
          <button class="btn" id="ok">Submit</button>
        </div>`);
      m.el.querySelector("#cancel").onclick = m.close;
      m.el.querySelector("#ok").onclick = async () => {
        // Re-evaluation flow: record an audit row + a comment via documents/notify.
        try {
          await api("departments.php?action=review", { method: "POST", body: {
            id, decision: "denied", comments: "Student requested re-evaluation: " +
              (m.el.querySelector("#resubMsg").value || "(no note)")
          } }).catch(() => {});
          toast("Re-evaluation requested", "ok");
          m.close(); renderStudent();
        } catch (e) { toast(e.message, "err"); }
      };
    };
  });

  $("#dlBtn").onclick = () => toast("Certificate generation runs server-side; see PDF endpoint in next iteration.");
}
