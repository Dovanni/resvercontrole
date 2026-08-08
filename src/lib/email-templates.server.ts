export function getRecoveryEmailTemplate(recoveryLink: string) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redefinição de Senha - VEJAMAIS</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background-color: #f9fafb; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { background: #0d9488; padding: 32px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 0.1em; }
        .content { padding: 40px; }
        .content h2 { color: #111827; margin-top: 0; font-size: 20px; text-align: center; }
        .content p { color: #4b5563; font-size: 16px; margin-bottom: 24px; }
        .button-container { text-align: center; margin: 32px 0; }
        .button { background: #0d9488; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px; transition: background 0.2s; }
        .footer { padding: 24px; background: #f3f4f6; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
        .notice { font-size: 14px; color: #9ca3af; text-align: center; font-style: italic; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>VEJAMAIS</h1>
        </div>
        <div class="content">
            <h2>Redefinição de senha</h2>
            <p>Olá,</p>
            <p>Recebemos uma solicitação para redefinir a sua senha de acesso à VEJAMAIS — Gestão Comercial e Financeira.</p>
            <div class="button-container">
                <a href="${recoveryLink}" class="button">Redefinir minha senha</a>
            </div>
            <p>Se você não solicitou esta alteração, pode ignorar este e-mail com segurança. Seu link é de uso único e tem validade limitada.</p>
            <p class="notice">Este link expira em breve por motivos de segurança.</p>
        </div>
        <div class="footer">
            &copy; 2026 VEJAMAIS. Todos os direitos reservados.
        </div>
    </div>
</body>
</html>
  `;
}
