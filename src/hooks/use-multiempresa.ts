import { useQuery } from "@tanstack/react-query";
import { getActiveEmpresa } from "@/lib/multiempresa.functions";
import { useServerFn } from "@tanstack/react-start";

export function useMultiempresa() {
  const fetchActiveEmpresa = useServerFn(getActiveEmpresa);
  
  const { data: empresa, isLoading } = useQuery({
    queryKey: ["active-empresa"],
    queryFn: () => fetchActiveEmpresa(),
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  const isEnabled = import.meta.env.VITE_ENABLE_MULTIEMPRESA === "true";

  return {
    empresa,
    empresaId: empresa?.id,
    isLoading,
    isEnabled
  };
}
