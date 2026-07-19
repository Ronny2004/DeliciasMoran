interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface TurnstileResponse {
  success: boolean;
  action?: string;
  hostname?: string;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  return forwardedFor?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return import.meta.env.DEV;

  const requestOrigin = new URL(request.url).origin;
  const configuredOrigins = (import.meta.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value: string) => value.trim())
    .filter(Boolean);

  return origin === requestOrigin || configuredOrigins.includes(origin);
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();

  if (rateLimitStore.size > 10_000) {
    for (const [storedKey, entry] of rateLimitStore) {
      if (entry.resetAt <= now) rateLimitStore.delete(storedKey);
    }
    if (rateLimitStore.size > 10_000) rateLimitStore.clear();
  }

  const existing = rateLimitStore.get(key);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfter: 0 };
}

export async function verifyTurnstile(
  token: unknown,
  remoteIp: string,
  expectedHostname: string,
): Promise<boolean> {
  const secret = import.meta.env.TURNSTILE_SECRET_KEY;

  if (!secret) return import.meta.env.DEV;
  if (typeof token !== 'string' || !token || token.length > 2048) return false;

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        response: token,
        remoteip: remoteIp,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return false;
    const result = await response.json() as TurnstileResponse;
    return result.success === true
      && result.action === 'vaco_request'
      && result.hostname === expectedHostname;
  } catch {
    return false;
  }
}

export function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}
