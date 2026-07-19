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
const RESERVATION_RATE_LIMIT = 3;
const RESERVATION_RATE_WINDOW_MS = 10 * 60_000;
const ALLOWED_FIELDS = new Set([
  'name',
  'phone',
  'date',
  'time',
  'people',
  'dishes',
  'notes',
  'turnstileToken',
]);

interface ReservationData {
  name: string;
  phone: string;
  date: string;
  time: string;
  people: number;
  dishes?: string;
  notes?: string;
}

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  return cleaned && cleaned.length <= maxLength ? cleaned : null;
}

function validateReservation(value: unknown): ReservationData | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !ALLOWED_FIELDS.has(key))) return null;

  const name = cleanString(body.name, 80);
  const phone = cleanString(body.phone, 24);
  const date = cleanString(body.date, 10);
  const time = cleanString(body.time, 5);
  const dishes = body.dishes ? cleanString(body.dishes, 300) : undefined;
  const notes = body.notes ? cleanString(body.notes, 300) : undefined;
  const people = Number(body.people);

  if (!name || name.length < 2 || !phone || !date || !time) return null;
  if (!Number.isInteger(people) || people < 1 || people > 20) return null;
  if (body.dishes && !dishes) return null;
  if (body.notes && !notes) return null;

  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 7 || phoneDigits.length > 15) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;

  const reservationDate = new Date(`${date}T12:00:00-05:00`);
  if (Number.isNaN(reservationDate.getTime())) return null;
  if (reservationDate.toISOString().slice(0, 10) !== date) return null;
  if (reservationDate.getUTCDay() === 0) return null;

  const todayInEcuador = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const today = new Date(`${todayInEcuador}T12:00:00-05:00`);
  const latestAllowedDate = new Date(today);
  latestAllowedDate.setDate(latestAllowedDate.getDate() + 365);
  if (reservationDate < today || reservationDate > latestAllowedDate) return null;

  const [hours, minutes] = time.split(':').map(Number);
  if (
    hours > 23
    || minutes > 59
    || hours < 15
    || hours > 22
    || (hours === 22 && minutes > 0)
  ) {
    return null;
  }

  return {
    name,
    phone,
    date,
    time,
    people,
    dishes: dishes || undefined,
    notes: notes || undefined,
  };
}

function formatReservationMessage(data: ReservationData): string {
  return `🔔 NUEVA RESERVA
🏪 Las Delicias de Morán
──────────────────────────────
👤 Nombre: ${data.name}
📱 Teléfono: ${data.phone}
📅 Fecha: ${data.date}
⏰ Hora: ${data.time}
👥 Personas: ${data.people}
${data.dishes ? `🍽️ Platos: ${data.dishes}` : ''}
${data.notes ? `📝 Notas: ${data.notes}` : ''}
──────────────────────────────`;
}

export const POST: APIRoute = async ({ request }) => {
  if (!isAllowedOrigin(request)) {
    return jsonResponse({ success: false, error: 'Origen no permitido.' }, 403);
  }

  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit(
    `reservation:${clientIp}`,
    RESERVATION_RATE_LIMIT,
    RESERVATION_RATE_WINDOW_MS,
  );
  if (!rateLimit.allowed) {
    return jsonResponse(
      {
        success: false,
        error: 'Has realizado demasiados intentos de reserva. Espera unos minutos.',
      },
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
    const data = validateReservation(body);
    if (!data) {
      return jsonResponse(
        {
          success: false,
          error: 'Los datos de la reserva no son válidos. Revisa fecha, hora, teléfono y personas.',
        },
        400,
      );
    }

    if (!await verifyTurnstile(
      body?.turnstileToken,
      clientIp,
      new URL(request.url).hostname,
    )) {
      return jsonResponse(
        {
          success: false,
          error: 'No pudimos verificar que seas una persona. Recarga la página e intenta nuevamente.',
        },
        403,
      );
    }

    const botToken = import.meta.env.TELEGRAM_BOT_TOKEN;
    const ownerChatId = import.meta.env.TELEGRAM_OWNER_CHAT_ID;
    if (!botToken || !ownerChatId) {
      return jsonResponse(
        {
          success: false,
          error: 'Las reservas no están disponibles temporalmente. Llámanos al 099 552 6145.',
        },
        503,
      );
    }

    const ownerRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ownerChatId,
        text: formatReservationMessage(data),
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!ownerRes.ok) {
      const errorBody = await ownerRes.json().catch(() => ({}));
      console.error('Failed to notify owner:', errorBody);
      return jsonResponse(
        {
          success: false,
          error: 'No pudimos confirmar la reserva. Llámanos al 099 552 6145.',
        },
        502,
      );
    }

    return jsonResponse({
      success: true,
      message: '¡Reserva confirmada! El restaurante recibió tus datos. Nos vemos pronto.',
    });
  } catch (error) {
    console.error('Reservation API error:', error);
    return jsonResponse(
      {
        success: false,
        error: 'No pudimos procesar la reserva. Intenta nuevamente.',
      },
      500,
    );
  }
};
