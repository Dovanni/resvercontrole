import { createStart } from "@tanstack/react-start";
import { createMiddleware } from "@tanstack/react-start";
import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error: any) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    
    // API routes should return JSON errors. 
    // In TanStack Start v1, we can detect the route type or use request context if available.
    // For now, we'll log and use a generic guard.
    console.error('[Middleware Error]', error);
    
    // If the error is already a Response, return it
    if (error instanceof Response) return error;

    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
