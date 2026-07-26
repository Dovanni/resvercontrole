import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CategoriasManagerInline } from "@/components/categorias-contas-pagar-manager";

export const Route = createFileRoute("/_authenticated/configuracoes/categorias")({
  head: () => ({ meta: [{ title: "Categorias de Despesas — Vejamais" }] }),
  component: CategoriasConfiguracoesPage,
});

function CategoriasConfiguracoesPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Categorias de Despesas"
        subtitle="Gerencie as categorias de contas a pagar"
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/configuracoes"><ArrowLeft className="size-4 mr-1" /> Configurações</Link>
          </Button>
        }
      />
      <Card className="shadow-soft">
        <CardContent className="p-6">
          <CategoriasManagerInline />
        </CardContent>
      </Card>
    </div>
  );
}