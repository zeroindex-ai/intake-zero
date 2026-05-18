import { z } from 'zod';

const Env = z.object({
  TURSO_DATABASE_URL: z.string().min(1),
  TURSO_AUTH_TOKEN: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  OWNER_EMAIL: z.string().email(),
  FROM_EMAIL: z.string().email(),
  ADMIN_TOKEN: z.string().min(32),
  PUBLIC_BASE_URL: z.string().url(),
});

export type Env = z.infer<typeof Env>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  cached = Env.parse(process.env);
  return cached;
}
