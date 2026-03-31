import nodemailer from "nodemailer";

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type InquiryNotification = {
  vendorEmail: string;
  vendorName: string;
  materialName: string;
  contactName: string;
  phone: string;
  company?: string;
  message?: string;
};

export async function sendInquiryNotification(
  data: InquiryNotification,
): Promise<void> {
  if (!transporter) {
    console.warn("[Email] SMTP not configured, skipping notification");
    return;
  }

  const materialName = escapeHtml(data.materialName);
  const contactName = escapeHtml(data.contactName);
  const phone = escapeHtml(data.phone);
  const company = data.company ? escapeHtml(data.company) : "";
  const message = data.message ? escapeHtml(data.message) : "";

  await transporter.sendMail({
    from: process.env.SMTP_FROM || "noreply@textura.app",
    to: data.vendorEmail,
    subject: `新的样品申请 — ${materialName}`,
    html: `
      <h2>新的样品申请</h2>
      <p><strong>材质:</strong> ${materialName}</p>
      <p><strong>联系人:</strong> ${contactName}</p>
      <p><strong>电话:</strong> ${phone}</p>
      ${company ? `<p><strong>公司:</strong> ${company}</p>` : ""}
      ${message ? `<p><strong>备注:</strong> ${message}</p>` : ""}
      <hr/>
      <p style="color: #888;">此邮件由 Textura 平台自动发送</p>
    `,
  });
}
