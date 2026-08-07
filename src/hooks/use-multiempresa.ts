import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyMultiempresaContext, validateCompanyAccess } from "@/lib/multiempresa.functions";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "vejamais:active_empresa_id";

export function useMultiempresa() {
  const queryClient = useQueryClient();
  const fetchContext = useServerFn(getMyMultiempresaContext);
  const validateAccess = useServerFn(validateCompanyAccess);
  
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY);
    }
    return null;
  });

  const { 
    data: companies = [], 
    isLoading: isListLoading, 
    error: listError,
    refetch 
  } = useQuery({
    queryKey: ["my-companies-context"],
    queryFn: () => fetchContext(),
    staleTime: 1000 * 60 * 5,
  });

  const empresa = companies.find(c => c.id === activeId) || 
                  companies.find(c => c.is_primary) || 
                  companies[0];

  useEffect(() => {
    if (empresa?.id && empresa.id !== activeId) {
      setActiveId(empresa.id);
      localStorage.setItem(STORAGE_KEY, empresa.id);
    }
  }, [empresa?.id, activeId]);

  const changeEmpresa = useCallback(async (newId: string) => {
    if (newId === activeId) return;

    try {
      await validateAccess({ data: newId });
      await queryClient.cancelQueries();
      queryClient.clear();
      setActiveId(newId);
      localStorage.setItem(STORAGE_KEY, newId);
      toast.success("Empresa alterada com sucesso");
    } catch (err) {
      console.error("Erro ao trocar de empresa:", err);
      toast.error("Erro ao trocar de empresa. Acesso não autorizado.");
    }
  }, [activeId, queryClient, validateAccess]);

  const isEnabled = import.meta.env.VITE_ENABLE_MULTIEMPRESA === "true";

  return {
    empresa,
    empresaId: empresa?.id,
    companies,
    activeEmpresaId: activeId,
    isLoading: isListLoading,
    isEnabled,
    error: listError,
    changeEmpresa,
    refetch
  };
}
