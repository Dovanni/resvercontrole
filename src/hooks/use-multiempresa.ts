import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyMultiempresaContext, validateCompanyAccess } from "@/lib/multiempresa.functions";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

const STORAGE_KEY = "vejamais:active_empresa_id";
const CONTEXT_TIMEOUT = 10000; // 10 segundos

export function useMultiempresa() {
  const queryClient = useQueryClient();
  const fetchContext = useServerFn(getMyMultiempresaContext);
  const validateAccess = useServerFn(validateCompanyAccess);
  const { user, loading: authLoading } = useAuth();
  
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY);
    }
    return null;
  });

  const { 
    data: companies = [], 
    isLoading: isListLoading, 
    isError,
    error,
    refetch 
  } = useQuery({
    queryKey: ["multiempresa-context", user?.id],
    queryFn: async () => {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT_ERROR")), CONTEXT_TIMEOUT)
      );
      
      try {
        const result = await Promise.race([fetchContext(), timeoutPromise]);
        return result as any[];
      } catch (err: any) {
        if (err.message === "TIMEOUT_ERROR") {
          throw new Error("O carregamento das empresas expirou. Verifique sua conexão.");
        }
        throw err;
      }
    },
    enabled: !authLoading && !!user?.id,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const empresa = useMemo(() => {
    if (!companies || companies.length === 0) return null;
    return companies.find(c => c.id === activeId) || 
           companies.find(c => c.is_primary) || 
           companies[0];
  }, [companies, activeId]);

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

  // O loading só é verdadeiro se auth ainda carrega OU se a lista está carregando E temos um usuário
  const isLoading = authLoading || (isListLoading && !!user?.id);

  return {
    empresa,
    empresaId: empresa?.id,
    companies,
    activeEmpresaId: activeId,
    isLoading,
    isEnabled,
    isError,
    error: error as Error | null,
    changeEmpresa,
    refetch,
    signedOut: !authLoading && !user
  };
}
