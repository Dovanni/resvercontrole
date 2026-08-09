import { createStart, createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
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
    try {
      request = getRequest();
    } catch (e) {
      // getRequest might fail if called outside of request context in some edge cases
    }

    const url = request ? new URL(request.url) : null;
    
    // Non-HTML routes should return JSON or text errors, not a full HTML page
    if (url && url.pathname.startsWith('/api/')) {
      console.error('[API Error]', url.pathname, error);
      return new Response(JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal Server Error',
        path: url.pathname,
        stack: error?.stack
      }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    console.error('[Global Error]', error);
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
