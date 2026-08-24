import { createServerFn } from "@tanstack/react-start";
import crypto from "crypto";

export interface MathChallenge {
  id: string;
  question: string;
  expiresAt: number;
}

const SECRET_MATH = process.env['RECAPTCHA_SECRET_KEY'] || 'preview-secret-key-math';

/**
 * Dedicated TanStack Start server-function boundary for the public math challenge.
 * Kept isolated from the broader security helper module so the Cloudflare/TanStack
 * build can register it explicitly in the server-functions manifest.
 */
export const getMathChallenge = createServerFn({ method: "GET" })
  .handler(async () => {
    const a = Math.floor(Math.random() * 20) + 1;
    const b = Math.floor(Math.random() * 20) + 1;
    const result = a + b;
    const id = crypto.randomUUID();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    const payload = JSON.stringify({ r: result, exp: expiresAt, id });
    const signature = crypto.createHmac('sha256', SECRET_MATH).update(payload).digest('hex');

    return {
      challenge: {
        id: `${Buffer.from(payload).toString('base64')}.${signature}`,
        question: `Quanto é ${a} + ${b}?`,
        expiresAt,
      } satisfies MathChallenge,
    };
  });
