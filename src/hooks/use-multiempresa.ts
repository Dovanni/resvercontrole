import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getActiveEmpresa, listMyCompanies, validateCompanyAccess } from "@/lib/multiempresa.functions";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "vejamais:active_empresa_id";

export function useMultiempresa() {
  const queryClient = useQueryClient();
  const fetchActiveEmpresa = useServerFn(getActiveEmpresa);
  const fetchMyCompanies = useServerFn(listMyCompanies);
  const validateAccess = useServerFn(validateCompanyAccess);
  
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY);
    }
    return null;
  });

  const { data: empresa, isLoading: isEmpresaLoading } = useQuery({
    queryKey: ["active-empresa", activeId],
    queryFn: async () => {
      // Se tivermos um ID no state/localStorage, validamos ele
      if (activeId) {
        try {
          await validateAccess({ data: activeId });
          // Se validou, buscamos os dados completos da empresa
          const companies = await fetchMyCompanies();
          const found = companies.find(c => c.id === activeId);
          if (found) return found;
        } catch (err) {
          console.warn("Empresa no storage inválida ou sem acesso, resetando para padrão.");
          localStorage.removeItem(STORAGE_KEY);
          setActiveId(null);
        }
      }
      
      // Fallback para a empresa padrão definida no servidor
      return fetchActiveEmpresa();
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: companies = [], isLoading: isListLoading } = useQuery({
    queryKey: ["my-companies"],
    queryFn: () => fetchMyCompanies(),
    enabled: !!empresa,
  });

  // Sincroniza o ID ativo quando a empresa é carregada (especialmente no primeiro carregamento)
  useEffect(() => {
    if (empresa?.id && empresa.id !== activeId) {
      setActiveId(empresa.id);
      localStorage.setItem(STORAGE_KEY, empresa.id);
    }
  }, [empresa?.id, activeId]);

  const changeEmpresa = useCallback(async (newId: string) => {
    if (newId === activeId) return;

    try {
      // 1. Validação server-side antes de trocar
      await validateAccess({ data: newId });
      
      // 2. Cancelar todas as queries em andamento para evitar "race conditions" ou respostas tardias
      await queryClient.cancelQueries();
      
      // 3. Limpar o cache completamente para garantir que nenhum dado da empresa anterior vaze
      queryClient.clear();
      
      // 4. Atualiza estado local e storage
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
    isLoading: isEmpresaLoading || isListLoading,
    isEnabled,
    changeEmpresa
  };
}
