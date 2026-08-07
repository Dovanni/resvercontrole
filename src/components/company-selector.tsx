import { useMultiempresa } from "@/hooks/use-multiempresa";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Building2, Loader2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function CompanySelector({ className }: { className?: string }) {
  const { empresa, companies, changeEmpresa, isLoading, isEnabled } = useMultiempresa();

  if (!isEnabled) return null;

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 px-3 h-10 border rounded-md", className)}>
        <Skeleton className="h-4 w-24" />
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn(
            "h-10 px-3 justify-between font-normal bg-background hover:bg-accent/50 border-input transition-colors w-full md:w-auto md:max-w-[320px]",
            className
          )}
        >
          <div className="flex items-center gap-2 overflow-hidden mr-2">
            <Building2 className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-medium truncate">
              {empresa?.nome || "Minha Empresa"}
            </span>
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[300px] p-1">
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground px-2 py-1.5 uppercase tracking-wider">
          Empresas e Unidades
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {companies.length > 1 ? (
          companies.map((item) => (
            <DropdownMenuItem
              key={item.id}
              onSelect={() => changeEmpresa(item.id)}
              className={cn(
                "flex items-center justify-between py-2 px-3 cursor-pointer rounded-sm mb-0.5",
                item.id === empresa?.id && "bg-accent"
              )}
            >
              <div className="flex flex-col gap-0.5 overflow-hidden">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-sm font-medium truncate",
                    item.id === empresa?.id ? "text-primary" : "text-foreground"
                  )}>
                    {item.nome}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground truncate">
                  {item.documento || "Sem documento"}
                </span>
              </div>
              {item.id === empresa?.id && (
                <Check className="h-4 w-4 text-primary shrink-0 ml-2" />
              )}
            </DropdownMenuItem>
          ))
        ) : (
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-muted-foreground italic">Nenhuma outra empresa disponível para alternância.</p>
          </div>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/minha-empresa" className="flex items-center w-full py-2 px-3 cursor-pointer text-sm">
            <Settings className="h-4 w-4 mr-2" />
            Gerenciar empresas e equipe
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}