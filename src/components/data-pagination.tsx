import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const DEFAULT_PAGE_SIZE = 20;

export function usePagination<T>(items: T[] | undefined, pageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const total = items?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const pageItems = useMemo(
    () => (items ?? []).slice((current - 1) * pageSize, current * pageSize),
    [items, current, pageSize],
  );
  return { page: current, setPage, totalPages, total, pageItems };
}

export function DataPagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total?: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t flex-wrap">
      <div className="text-xs text-muted-foreground">
        {total !== undefined ? `${total} registro${total === 1 ? "" : "s"}` : null}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft className="size-4" /> Anterior
        </Button>
        <span className="text-sm text-muted-foreground">
          Página {page} de {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Próxima <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
