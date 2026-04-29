// Certificate preview + print + QR
window.Cert = (() => {
  const open = (app, profile, depts) => {
    const ref = app.certificate_ref || U.certRef(app.id);
    const issued = app.certificate_issued_at || new Date().toISOString();
    const verifyPayload = JSON.stringify({
      ref, student: profile?.full_name, course: app.course, batch: app.batch,
      issued, departments: depts.map((d) => d.name),
    });
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(verifyPayload)}`;

    const cert = U.el("div", { class: "cert-frame" }, [
      U.el("div", { class: "muted small", text: "University of Lovable" }),
      U.el("h1", { text: "Certificate of Clearance" }),
      U.el("p", { class: "muted small", text: "This is to certify that" }),
      U.el("h2", { style: { fontSize: "26px", margin: "8px 0" }, text: profile?.full_name || "Student" }),
      U.el("p", { text: `has successfully completed all clearance requirements for` }),
      U.el("p", { class: "bold", text: `${app.course} (${app.batch})` }),
      U.el("p", { class: "small mt-3", text: "Cleared by departments:" }),
      U.el("p", { class: "small bold", text: depts.map((d) => d.name).join(" · ") }),
      U.el("div", { class: "seal mt-4" }, [
        U.el("div", { style: { textAlign: "left" } }, [
          U.el("div", { class: "small muted", text: "Reference" }),
          U.el("div", { class: "bold", text: ref }),
          U.el("div", { class: "small muted mt-2", text: "Issued" }),
          U.el("div", { class: "bold", text: U.fmtDateShort(issued) }),
        ]),
        U.el("img", { src: qrUrl, alt: "QR verification", style: { width: "120px", height: "120px" } }),
      ]),
    ]);

    const printBtn = U.el("button", { class: "btn", html: U.icon("download") + " <span>Print / Save PDF</span>", onClick: () => window.print() });
    const close = U.el("button", { class: "btn btn-outline", text: "Close" });
    const m = U.modal({
      title: "Clearance certificate",
      body: cert,
      footer: [close, printBtn],
    });
    close.onclick = () => m.close();
  };
  return { openCertificate: open };
})();
