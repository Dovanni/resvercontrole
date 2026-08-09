import { createMiddleware, getRequest } from "@tanstack/react-start";
import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error: any) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    
    let request;
    let url;
    try {
      request = getRequest();
      url = request ? new URL(request.url) : null;
    } catch (e) {
      // getRequest might fail if called outside of request context
    }
    
    // Non-HTML routes (API) should return JSON or text errors
    if (url && url.pathname.startsWith('/api/')) {
      console.error('[API Error Middleware]', url.pathname, error);
      
      // If the error is already a Response, return it
      if (error instanceof Response) return error;

      return new Response(JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal Server Error',
        path: url.pathname
      }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    console.error('[Global Error Middleware]', error);
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
