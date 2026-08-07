import { useMultiempresa } from "@/hooks/use-multiempresa";
import { Button } from "@/components/ui/button";
import { Building2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "@tanstack/react-router";

export function CompanySelector({ className }: { className?: string }) {
  const { empresa, isLoading, isEnabled } = useMultiempresa();
  const navigate = useNavigate();

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
    <Button
      variant="outline"
      onClick={() => navigate({ to: "/minha-empresa" })}
      className={cn(
        "h-10 px-3 justify-start font-normal bg-background hover:bg-accent/50 border-input transition-colors w-full md:w-auto md:max-w-[320px]",
        className
      )}
    >
      <div className="flex items-center gap-2 overflow-hidden mr-2">
        <Building2 className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-medium truncate">
          {empresa?.nome || "Minha Empresa"}
        </span>
      </div>
    </Button>
  );
}