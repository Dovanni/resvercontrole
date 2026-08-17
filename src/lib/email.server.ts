import nodemailer from "nodemailer";

export async function sendMail({ to, subject, html, attachments }: { 
  to: string; 
  subject: string; 
  html: string; 
  attachments?: any[] 
}) {
  const host = process.env['SMTP_HOST'];
  const port = parseInt(process.env['SMTP_PORT'] || '465');
  const user = process.env['SMTP_USER'];
  const pass = process.env['SMTP_PASSWORD'];
  const fromEmail = process.env['SMTP_FROM_EMAIL'];
  const fromName = process.env['SMTP_FROM_NAME'] || 'VEJAMAIS ERP';

  if (!host || !user || !pass || !fromEmail) {
    throw new Error("Configuração SMTP incompleta.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
    attachments,
  });
}
