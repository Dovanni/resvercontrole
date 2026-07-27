export const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

export const dateBR = (s: string) => {
  // Datas civis "YYYY-MM-DD" devem ser tratadas como locais (sem deslocamento por UTC).
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const d = ymd
    ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
    : new Date(s);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};
