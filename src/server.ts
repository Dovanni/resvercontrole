import "./lib/error-capture";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

/**
 * Normalizes catastrophic SSR responses from the h3/vinxi layer.
 * API routes should return their original response or a JSON error.
 */
async function normalizeCatastrophicSsrResponse(request: Request, response: Response): Promise<Response> {
  const url = new URL(request.url);
  const isApi = url.pathname.startsWith('/api/');

  if (response.status < 500) return response;
  
  if (isApi) {
    // Return original response if it's already structured, or wrap if it's the h3 error
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const cloned = response.clone();
      const body = await cloned.text();
      if (body.includes('"unhandled":true')) {
        return new Response(JSON.stringify({
          error: "Internal Server Error (API)",
          path: url.pathname,
          original: JSON.parse(body)
        }), {
          status: 500,
          headers: { "content-type": "application/json" }
        });
      }
    }
    return response;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(request, response);
    } catch (error) {
      console.error('[SSR Fetch Error]', url.pathname, error);
      
      if (url.pathname.startsWith('/api/')) {
        return new Response(JSON.stringify({ 
          error: error instanceof Error ? error.message : 'Internal Server Error',
          path: url.pathname
        }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
