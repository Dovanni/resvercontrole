import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { isValidCPF, isValidCNPJ, onlyDigits } from "@/lib/validators";

export const Route = createFileRoute("/_authenticated/importar")({
  head: () => ({ meta: [{ title: "Importar dados — Vejamais" }] }),
  component: ImportPage,
});

type RowResult<T> = { row: number; data: T | null; errors: string[] };

type CustomerIn = {
  name: string;
  document: string | null;
  person_type: "pf" | "pj";
  customer_type: "varejo" | "atacado";
  email: string | null;
  phone: string | null;
};

type ProductIn = {
  name: string;
  sku: string | null;
  category: string | null;
  cost_price: number;
  sale_price: number;
  wholesale_price: number;
  stock: number;
};

const norm = (v: any) => (v == null ? "" : String(v).trim());
const toNum = (v: any) => {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

function parseCustomers(rows: any[]): RowResult<CustomerIn>[] {
  return rows.map((r, i) => {
    const errors: string[] = [];
    const name = norm(r.nome ?? r.name);
    const doc = onlyDigits(norm(r.cpf_cnpj ?? r.documento ?? ""));
    const tipoRaw = norm(r.tipo_cliente ?? r.tipo).toLowerCase();
    const email = norm(r.email);
    const phone = norm(r.telefone ?? r.phone);

    if (!name) errors.push("Nome obrigatório");
    let customer_type: "varejo" | "atacado" = "varejo";
    if (tipoRaw === "atacado") customer_type = "atacado";
    else if (tipoRaw === "varejo" || tipoRaw === "") customer_type = "varejo";
    else errors.push(`tipo_cliente inválido (${tipoRaw}) — use 'varejo' ou 'atacado'`);

    let person_type: "pf" | "pj" = "pf";
    if (doc) {
      if (doc.length === 11) {
        person_type = "pf";
        if (!isValidCPF(doc)) errors.push("CPF inválido");
      } else if (doc.length === 14) {
        person_type = "pj";
        if (!isValidCNPJ(doc)) errors.push("CNPJ inválido");
      } else errors.push("cpf_cnpj deve ter 11 ou 14 dígitos");
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.push("email inválido");

    return {
      row: i + 2,
      errors,
      data: errors.length
        ? null
        : { name, document: doc || null, person_type, customer_type, email: email || null, phone: phone || null },
    };
  });
}

function parseProducts(rows: any[]): RowResult<ProductIn>[] {
  return rows.map((r, i) => {
    const errors: string[] = [];
    const name = norm(r.nome ?? r.name);
    const sku = norm(r.sku);
    const category = norm(r.categoria ?? r.category);
    const cost_price = toNum(r.preco_custo ?? r.cost_price);
    const sale_price = toNum(r.preco_varejo ?? r.sale_price);
    const wholesale_price = toNum(r.preco_atacado ?? r.wholesale_price);
    const stockN = toNum(r.estoque_atual ?? r.stock);

    if (!name) errors.push("Nome obrigatório");
    if (!Number.isFinite(cost_price)) errors.push("preco_custo inválido");
    if (!Number.isFinite(sale_price)) errors.push("preco_varejo inválido");
    if (!Number.isFinite(wholesale_price)) errors.push("preco_atacado inválido");
    if (!Number.isFinite(stockN)) errors.push("estoque_atual inválido");

    return {
      row: i + 2,
      errors,
      data: errors.length
        ? null
        : {
            name,
            sku: sku || null,
            category: category || null,
            cost_price,
            sale_price,
            wholesale_price,
            stock: Math.trunc(stockN),
          },
    };
  });
}

function ImportPage() {
  const { user, can } = useAuth();
  if (!can("view:settings")) return <Navigate to="/dashboard" />;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/configuracoes"><ArrowLeft className="size-4 mr-1" /> Configurações</Link>
        </Button>
      </div>
      <PageHeader title="Importar planilha" subtitle="Upload em massa de clientes ou produtos via Excel (.xlsx)" />
      <Tabs defaultValue="customers">
        <TabsList>
          <TabsTrigger value="customers">Clientes</TabsTrigger>
          <TabsTrigger value="products">Produtos</TabsTrigger>
        </TabsList>
        <TabsContent value="customers">
          <ImportPanel
            kind="customers"
            userId={user!.id}
            columns={["nome", "cpf_cnpj", "tipo_cliente", "email", "telefone"]}
            parse={parseCustomers}
            previewColumns={["name", "document", "person_type", "customer_type", "email", "phone"]}
            table="customers"
          />
        </TabsContent>
        <TabsContent value="products">
          <ImportPanel
            kind="products"
            userId={user!.id}
            columns={["nome", "sku", "categoria", "preco_custo", "preco_varejo", "preco_atacado", "estoque_atual"]}
            parse={parseProducts}
            previewColumns={["name", "sku", "category", "cost_price", "sale_price", "wholesale_price", "stock"]}
            table="products"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ImportPanel<T extends Record<string, any>>({
  kind,
  userId,
  columns,
  parse,
  previewColumns,
  table,
}: {
  kind: "customers" | "products";
  userId: string;
  columns: string[];
  parse: (rows: any[]) => RowResult<T>[];
  previewColumns: string[];
  table: "customers" | "products";
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>("");
  const [results, setResults] = useState<RowResult<T>[]>([]);
  const [importing, setImporting] = useState(false);

  const valid = results.filter((r) => r.data);
  const invalid = results.filter((r) => !r.data);

  const onFile = async (file: File) => {
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
    // normalize header keys to lower snake
    const normalized = rows.map((r: any) => {
      const out: any = {};
      for (const k of Object.keys(r)) {
        const nk = k.toString().trim().toLowerCase().replace(/\s+/g, "_");
        out[nk] = r[k];
      }
      return out;
    });
    setResults(parse(normalized));
  };

  const confirmImport = async () => {
    if (!valid.length) return;
    setImporting(true);
    try {
      const payload = valid.map((r) => ({ ...(r.data as any), user_id: userId }));
      // chunked insert
      const chunk = 200;
      for (let i = 0; i < payload.length; i += chunk) {
        const { error } = await supabase.from(table as any).insert(payload.slice(i, i + chunk));
        if (error) throw error;
      }
      toast.success(`${payload.length} ${kind === "customers" ? "clientes" : "produtos"} importados`);
      setResults([]);
      setFileName("");
    } catch (e: any) {
      toast.error(e.message ?? "Erro na importação");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([Object.fromEntries(columns.map((c) => [c, ""]))]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, kind);
    XLSX.writeFile(wb, `modelo-${kind}.xlsx`);
  };

  return (
    <Card className="shadow-soft mt-4">
      <CardContent className="p-6 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4 mr-1" /> Selecionar arquivo .xlsx
          </Button>
          <Button variant="ghost" onClick={downloadTemplate}>
            <FileSpreadsheet className="size-4 mr-1" /> Baixar modelo
          </Button>
          {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Colunas esperadas: <code>{columns.join(", ")}</code>
        </p>

        {results.length > 0 && (
          <>
            <div className="flex gap-2">
              <Badge variant="secondary"><CheckCircle2 className="size-3 mr-1" /> {valid.length} válidos</Badge>
              {invalid.length > 0 && (
                <Badge variant="destructive"><AlertCircle className="size-3 mr-1" /> {invalid.length} com erro</Badge>
              )}
            </div>

            {invalid.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-destructive/10 text-sm font-medium">Linhas com erro</div>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Linha</TableHead><TableHead>Erros</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {invalid.map((r) => (
                      <TableRow key={r.row}>
                        <TableCell>{r.row}</TableCell>
                        <TableCell className="text-destructive text-sm">{r.errors.join("; ")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {valid.length > 0 && (
              <div className="border rounded-lg overflow-auto">
                <div className="px-3 py-2 bg-muted text-sm font-medium">Prévia ({Math.min(valid.length, 20)} de {valid.length})</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Linha</TableHead>
                      {previewColumns.map((c) => <TableHead key={c}>{c}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {valid.slice(0, 20).map((r) => (
                      <TableRow key={r.row}>
                        <TableCell>{r.row}</TableCell>
                        {previewColumns.map((c) => (
                          <TableCell key={c} className="text-sm">{String((r.data as any)?.[c] ?? "")}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <Button
              onClick={confirmImport}
              disabled={!valid.length || importing}
              className="w-full bg-gradient-primary text-primary-foreground"
            >
              {importing ? "Importando…" : `Confirmar importação de ${valid.length} registros`}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
