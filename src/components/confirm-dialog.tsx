import { createContext, useContext, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export type ConfirmOptions = {
  title?: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

type Ctx = (opts?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Ctx>(() => Promise.resolve(false));

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    open: boolean;
    opts: ConfirmOptions;
    resolve?: (v: boolean) => void;
  }>({ open: false, opts: {} });

  const confirm: Ctx = (opts = {}) =>
    new Promise<boolean>((resolve) => setState({ open: true, opts, resolve }));

  const close = (v: boolean) => {
    state.resolve?.(v);
    setState((s) => ({ ...s, open: false }));
  };

  const { opts } = state;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={state.open} onOpenChange={(o) => { if (!o) close(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              {opts.title ?? "Confirmar exclusão"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {opts.description ?? "Esta ação não pode ser desfeita. Deseja continuar?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>
              {opts.cancelText ?? "Cancelar"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => close(true)}
              className={cn(
                opts.destructive !== false &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
            >
              {opts.confirmText ?? "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
