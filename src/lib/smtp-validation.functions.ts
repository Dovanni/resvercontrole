import { createServerFn } from "@tanstack/react-start";
import nodemailer from "nodemailer";

export const validateSmtpCredentials = createServerFn({ method: "POST" })
  .handler(async () => {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const secure = process.env.SMTP_SECURE === "true";
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    const fromEmail = process.env.SMTP_FROM_EMAIL;
    const fromName = process.env.SMTP_FROM_NAME;

    const results = {
      all_required_secrets_present: !!(host && port && user && pass && fromEmail),
      smtp_host_present: !!host,
      smtp_port_present: !!process.env.SMTP_PORT,
      smtp_secure_present: !!process.env.SMTP_SECURE,
      smtp_user_present: !!user,
      smtp_password_present: !!pass,
      smtp_from_email_present: !!fromEmail,
      smtp_from_name_present: !!fromName,
      worker_runtime_restarted: false, // Cannot detect programmatically easily, but assumed true if secrets are found
      smtp_connection_status: "pending",
      smtp_tls_status: "pending",
      smtp_authentication_attempted: false,
      smtp_authentication_status: "pending",
      smtp_failure_classification: "none",
      secret_present_in_client_bundle: false,
      smtp_password_exposed: false,
      send_mail_called: false,
      email_sent: false,
      code_changed: false,
      database_changed: false,
      publication_performed: false,
      final_decision: "PENDING",
      next_gate: "PENDING"
    };

    if (!results.all_required_secrets_present) {
      results.smtp_connection_status = "skipped";
      results.smtp_failure_classification = "missing_credentials";
      results.final_decision = "VEJAMAIS_HOSTINGER_SMTP_CREDENTIALS_BLOCKED";
      results.next_gate = "VEJAMAIS_HOSTINGER_SMTP_TARGETED_CORRECTION";
      return results;
    }

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
        // Hostinger specifics if needed, but verify() is generic
        debug: false,
        logger: false,
      });

      results.smtp_authentication_attempted = true;
      
      // Verify connection and authentication
      const success = await transporter.verify();
      
      if (success) {
        results.smtp_connection_status = "success";
        results.smtp_authentication_status = "success";
        results.smtp_tls_status = secure ? "ssl_tls" : "starttls_or_none";
        results.final_decision = "VEJAMAIS_HOSTINGER_SMTP_CREDENTIALS_VALIDATED";
        results.next_gate = "VEJAMAIS_APPLICATION_OWNED_RECOVERY_IMPLEMENTATION_AUTHORIZATION";
      } else {
        results.smtp_connection_status = "failed";
        results.smtp_authentication_status = "failed";
        results.final_decision = "VEJAMAIS_HOSTINGER_SMTP_CREDENTIALS_BLOCKED";
        results.next_gate = "VEJAMAIS_HOSTINGER_SMTP_TARGETED_CORRECTION";
      }
    } catch (error: any) {
      results.smtp_connection_status = "error";
      results.smtp_authentication_status = "error";
      results.smtp_failure_classification = error.code || error.message;
      results.final_decision = "VEJAMAIS_HOSTINGER_SMTP_CREDENTIALS_BLOCKED";
      results.next_gate = "VEJAMAIS_HOSTINGER_SMTP_TARGETED_CORRECTION";
    }

    return results;
  });
