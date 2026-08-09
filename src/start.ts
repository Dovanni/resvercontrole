import { createStart } from "@tanstack/react-start";
import { createMiddleware } from "@tanstack/react-start";
import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error: any) {
    // Don't swallow redirect or known status throws
    if (error != null && typeof error === "object" && ("statusCode" in error || "redirect" in error)) {
      throw error;
    }
    
    // In TanStack Start v1 dev mode, we can't reliably detect the path here without extra context
    // but we can at least log what happened before re-throwing or wrapping.
    console.error('[Middleware Error Catch]', error);
    
    // If the error is already a Response, return it
    if (error instanceof Response) return error;

    // Rethrow to let server.ts handle the final response format based on path
    throw error;
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
