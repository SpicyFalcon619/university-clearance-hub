import jsPDF from "jspdf";

export function generateCertificate(opts: {
  reference: string;
  studentName: string;
  course: string;
  batch: string;
  issuedAt: Date;
  departments: string[];
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Border
  doc.setDrawColor(30, 30, 40);
  doc.setLineWidth(2);
  doc.rect(24, 24, W - 48, H - 48);
  doc.setLineWidth(0.5);
  doc.rect(34, 34, W - 68, H - 68);

  // Heading
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.setTextColor(20, 20, 30);
  doc.text("Certificate of Clearance", W / 2, 110, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(90, 90, 100);
  doc.text("UNIVERSITY ONLINE CLEARANCE SYSTEM", W / 2, 132, { align: "center" });

  // Body
  doc.setFontSize(13);
  doc.setTextColor(40, 40, 50);
  doc.text("This is to certify that", W / 2, 200, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text(opts.studentName, W / 2, 240, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(60, 60, 70);
  doc.text(
    `enrolled in ${opts.course} (${opts.batch}) has successfully completed all institutional clearance`,
    W / 2, 280, { align: "center" }
  );
  doc.text(
    "requirements across the following departments:",
    W / 2, 300, { align: "center" }
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 30);
  doc.text(opts.departments.join("  ·  "), W / 2, 332, { align: "center" });

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 120);
  doc.text(`Reference: ${opts.reference}`, 60, H - 70);
  doc.text(`Issued: ${opts.issuedAt.toLocaleDateString()}`, 60, H - 54);

  doc.setDrawColor(20, 20, 30);
  doc.line(W - 240, H - 80, W - 60, H - 80);
  doc.setFontSize(10);
  doc.text("Registrar's Office", W - 150, H - 64, { align: "center" });

  doc.save(`Clearance-Certificate-${opts.reference}.pdf`);
}
