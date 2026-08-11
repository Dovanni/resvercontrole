import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getCheckoutStatusImpl } from "./billing-status.server";

export const getCheckoutStatus = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ empresaId: z.string().uuid() }).strict().parse(data))
  .handler(async ({ data }) => {
    const req = getRequest();
    const host = req.headers.get('host');
    const origin = req.headers.get('origin');
    
    return getCheckoutStatusImpl(data.empresaId, host, origin);
  });
