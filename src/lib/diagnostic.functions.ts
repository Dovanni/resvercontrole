import { createServerFn } from "@tanstack/react-start";

export const checkSecretPresence = createServerFn({ method: "GET" })
  .handler(async () => {
    const isPresent = !!process.env['TURNSTILE_SECRET_KEY'];
    console.log(`[DIAGNOSTIC] TURNSTILE_SECRET_KEY presence check: ${isPresent}`);
    return { present: isPresent };
  });
