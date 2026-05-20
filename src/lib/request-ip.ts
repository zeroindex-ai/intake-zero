// Derive the client IP for rate-limiting.
//
// On Vercel, `x-real-ip` is set by the platform to the true client IP and
// cannot be forged by the caller. The leftmost `x-forwarded-for` hop, by
// contrast, IS caller-controlled — a client can prepend an arbitrary value to
// rotate past a per-IP cap — so we never trust it. When `x-real-ip` is absent
// (e.g. local dev), fall back to the LAST `x-forwarded-for` entry, which is the
// one appended by the trusted proxy.
export function clientIp(req: Request): string {
  const real = req.headers.get('x-real-ip')?.trim();
  if (real) return real;

  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const hops = fwd
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1]!;
  }

  return 'unknown';
}
