// Traduz mensagens de erro do Supabase Auth para português amigável.
export function translateAuthError(message?: string | null): string {
  if (!message) return "Algo deu errado. Tente novamente.";
  const m = message.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials"))
    return "Email ou senha incorretos.";
  if (m.includes("email not confirmed"))
    return "Confirme seu email antes de entrar.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "Este email já está cadastrado. Faça login.";
  if (m.includes("password should be at least"))
    return "A senha precisa ter ao menos 6 caracteres.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (m.includes("network") || m.includes("fetch"))
    return "Sem conexão com o servidor. Verifique sua internet.";
  if (m.includes("signups not allowed") || m.includes("disabled"))
    return "Cadastro temporariamente indisponível.";
  if (m.includes("unable to validate email") || m.includes("invalid email"))
    return "Email inválido.";
  return "Não foi possível concluir. Tente novamente.";
}
