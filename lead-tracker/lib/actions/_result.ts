// Uniform server-action result. Actions never throw across the boundary for
// expected failures — they return a typed result the client can render.
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

// Translate common Postgres/PostgREST errors into human messages.
export function messageFromError(e: unknown): string {
  const err = e as { message?: string; code?: string; details?: string };
  const msg = err?.message ?? "Something went wrong";
  if (msg.includes("Illegal status transition")) return "That status change isn't allowed.";
  if (msg.includes("correct a status backward")) return msg;
  if (msg.includes("lost reason") || msg.includes("lost_needs_reason")) return "A lost reason is required.";
  if (err?.code === "42501" || msg.includes("row-level security")) return "You don't have permission to do that.";
  if (err?.code === "23505") return "That already exists (duplicate).";
  return msg;
}
