import type { APIRoute } from 'astro';
import {
  checkRateLimit,
  getClientIp,
  isAllowedOrigin,
  jsonResponse,
  verifyTurnstile,
} from '../../lib/api-security';

export const prerender = false;

const MAX_BODY_SIZE = 20_000;
const ORDER_RATE_LIMIT = 5;
const ORDER_RATE_WINDOW_MS = 10 * 60_000;
const ALLOWED_FIELDS = new Set([
  'name',
  'phone',
  'items',
  'notes',
  'latitude',
  'longitude',
  'turnstileToken',
]);

interface OrderData {
  name: string;
  phone: string;
  items: string;
  notes?: string;
  latitude: number;
  longitude: number;
}

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  return cleaned && cleaned.length <= maxLength ? cleaned : null;
}

function isRestaurantOpen(): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Guayaquil',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (values.weekday === 'Sun') return false;
  const minutes = Number(values.hour) * 60 + Number(values.minute);
  return minutes >= 15 * 60 && minutes < 22 * 60;
}

function validateOrder(value: unknown): OrderData | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !ALLOWED_FIELDS.has(key))) return null;

  const name = cleanString(body.name, 80);
  const phone = cleanString(body.phone, 24);
  const items = cleanString(body.items, 600);
  const notes = body.notes ? cleanString(body.notes, 300) : undefined;
  const latitude = body.latitude;
  const longitude = body.longitude;

  if (!name || name.length < 2 || !phone || !items) return null;
  if (body.notes && !notes) return null;
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 7 || phoneDigits.length > 15) return null;
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;

  return { name, phone, items, notes: notes || undefined, latitude, longitude };
}

function formatOrderMessage(data: OrderData): string {
  const mapsUrl = `https://www.google.com/maps?q=${data.latitude},${data.longitude}`;
  return `🛵 NUEVO PEDIDO
🏪 Las Delicias de Morán
─────────────────────────────
👤 Nombre: ${data.name}
📱 Teléfono: ${data.phone}
🍽️ Pedido: ${data.items}
${data.notes ? `📝 Notas: ${data.notes}\n` : ''}📍 Ubicación: ${mapsUrl}
─────────────────────────────`;
}

export const POST: APIRoute = async ({ request }) => {
  if (!isAllowedOrigin(request)) {
    return jsonResponse({ success: false, error: 'Origen no permitido.' }, 403);
  }

  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit(`order:${clientIp}`, ORDER_RATE_LIMIT, ORDER_RATE_WINDOW_MS);
  if (!rateLimit.allowed) {
    return jsonResponse(
      { success: false, error: 'Has realizado demasiados intentos. Espera unos minutos.' },
      429,
      { 'Retry-After': String(rateLimit.retryAfter) },
    );
  }

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_SIZE) {
    return jsonResponse({ success: false, error: 'La solicitud es demasiado grande.' }, 413);
  }

  try {
    const body = await request.json();
    const data = validateOrder(body);
    if (!data) {
      return jsonResponse({
        success: false,
        error: 'Revisa el nombre, teléfono, pedido y ubicación.',
      }, 400);
    }

    if (!isRestaurantOpen()) {
      return jsonResponse({
        success: false,
        error: 'En este momento estamos cerrados. Recibimos pedidos de lunes a sábado, de 3:00 PM a 10:00 PM.',
      }, 409);
    }

    if (!await verifyTurnstile(body?.turnstileToken, clientIp, new URL(request.url).hostname)) {
      return jsonResponse({
        success: false,
        error: 'No pudimos verificar que seas una persona. Recarga la página e intenta nuevamente.',
      }, 403);
    }

    const botToken = import.meta.env.TELEGRAM_BOT_TOKEN;
    const ownerChatId = import.meta.env.TELEGRAM_OWNER_CHAT_ID;
    if (!botToken || !ownerChatId) {
      return jsonResponse({
        success: false,
        error: 'Los pedidos no están disponibles temporalmente. Llámanos al 099 552 6145.',
      }, 503);
    }

    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ownerChatId, text: formatOrderMessage(data) }),
      signal: AbortSignal.timeout(8000),
    });

    if (!telegramResponse.ok) {
      console.error('Order notification failed', { status: telegramResponse.status });
      return jsonResponse({
        success: false,
        error: 'No pudimos enviar tu pedido. Llámanos al 099 552 6145.',
      }, 502);
    }

    return jsonResponse({
      success: true,
      message: '¡Pedido enviado! El restaurante recibió tu solicitud y ubicación.',
    });
  } catch (error) {
    console.error('Order request failed', {
      timeout: error instanceof Error && error.name === 'TimeoutError',
    });
    return jsonResponse({
      success: false,
      error: 'No pudimos procesar tu pedido. Intenta nuevamente.',
    }, 500);
  }
};
