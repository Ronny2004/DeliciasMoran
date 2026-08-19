import type { APIRoute } from 'astro';
import { GoogleGenAI } from '@google/genai';
import { SYSTEM_PROMPT } from '../../lib/restaurant-info';
import {
  checkRateLimit,
  getClientIp,
  isAllowedOrigin,
  jsonResponse,
  verifyTurnstile,
} from '../../lib/api-security';

export const prerender = false;

const MAX_MESSAGE_LENGTH = 500;
const MAX_CONTEXT_ITEMS = 2;
const MAX_CONTEXT_TEXT_LENGTH = 1_000;
const MAX_CONTEXT_TOTAL_LENGTH = 1_500;
const MAX_BODY_SIZE = 10_000;
const CHAT_RATE_LIMIT = 12;
const CHAT_RATE_WINDOW_MS = 60_000;
const GEMINI_TIMEOUT_MS = 25_000;

interface SafeContextItem {
  role: 'user' | 'model';
  text: string;
}

const RESERVATION_INTENT = /\b(reserv(?:a|ar|aci[oó]n|aciones)|apartar\s+(?:una\s+)?mesa|mesa\s+para\s+\d+)\b/i;
const PERSONAL_DATA_PATTERNS = [
  /[\w.%+-]+@[\w.-]+\.[a-z]{2,}/i,
  /(?:\+?\d[\s().-]*){7,}/,
  /\b(?:c[eé]dula|pasaporte|identificaci[oó]n|ruc)\b/i,
  /\b(?:me\s+llamo|mi\s+nombre\s+es)\s+[a-záéíóúñü]{2,}(?:\s+[a-záéíóúñü]{2,}){0,3}\b/i,
  /\b(?:mi\s+direcci[oó]n|vivo\s+en|domicilio)\b/i,
];

function getEcuadorDateTime(): string {
  return new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
}

function containsPersonalData(text: string): boolean {
  return PERSONAL_DATA_PATTERNS.some((pattern) => pattern.test(text));
}

function parseSafeContext(value: unknown): SafeContextItem[] | null {
  if (!Array.isArray(value) || value.length > MAX_CONTEXT_ITEMS) return null;

  let totalLength = 0;
  const context: SafeContextItem[] = [];

  for (const item of value) {
    if (!item || (item.role !== 'user' && item.role !== 'model') || typeof item.text !== 'string') {
      return null;
    }
    const text = item.text.trim();
    if (!text || text.length > MAX_CONTEXT_TEXT_LENGTH || containsPersonalData(text)) return null;
    totalLength += text.length;
    if (totalLength > MAX_CONTEXT_TOTAL_LENGTH) return null;
    context.push({ role: item.role, text });
  }

  return context;
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error
    && (error.name === 'AbortError' || /timeout|timed out/i.test(error.message));
}

export const POST: APIRoute = async ({ request }) => {
  const startedAt = Date.now();

  if (!isAllowedOrigin(request)) {
    return jsonResponse({ success: false, error: 'Origen no permitido.' }, 403);
  }

  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit(`chat:${clientIp}`, CHAT_RATE_LIMIT, CHAT_RATE_WINDOW_MS);
  if (!rateLimit.allowed) {
    return jsonResponse(
      { success: false, error: 'Has enviado demasiados mensajes. Espera un momento e intenta nuevamente.' },
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
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const context = parseSafeContext(body?.context);

    if (!message) return jsonResponse({ success: false, error: 'Escribe un mensaje para continuar.' }, 400);
    if (message.length > MAX_MESSAGE_LENGTH) {
      return jsonResponse({ success: false, error: `El mensaje no puede superar los ${MAX_MESSAGE_LENGTH} caracteres.` }, 400);
    }
    if (!context) return jsonResponse({ success: false, error: 'El contexto del chat no es válido.' }, 400);

    // Esta barrera se ejecuta antes de crear el cliente de Gemini.
    if (containsPersonalData(message)) {
      return jsonResponse({
        success: false,
        code: 'PERSONAL_DATA_BLOCKED',
        error: 'Por tu seguridad, comparte tus datos únicamente en el formulario de reserva.',
        action: RESERVATION_INTENT.test(message) ? 'open_reservation' : undefined,
      }, 422);
    }

    // Las reservas se gestionan exclusivamente con código y Telegram.
    if (RESERVATION_INTENT.test(message)) {
      return jsonResponse({
        success: true,
        response: '¡Claro! Completa tus datos y enviaremos tu solicitud al restaurante.',
        action: 'open_reservation',
      });
    }

    if (!await verifyTurnstile(body?.turnstileToken, clientIp, new URL(request.url).hostname)) {
      return jsonResponse({
        success: false,
        error: 'No pudimos verificar que seas una persona. Recarga la página e intenta nuevamente.',
      }, 403);
    }

    const apiKey = import.meta.env.GEMINI_API_KEY;
    if (!apiKey) return jsonResponse({ success: false, error: 'El asistente no está configurado temporalmente.' }, 503);

    const recentContext = context
      .map((item) => `${item.role === 'user' ? 'Cliente' : 'Vaco'}: ${item.text}`)
      .join('\n');
    // Interactions acepta texto directamente. El arreglo de objetos usado antes
    // no coincidía con el esquema de Steps y fallaba antes de realizar la petición.
    const input = recentContext
      ? `Contexto reciente de la conversación:\n${recentContext}\n\nMensaje actual del cliente: ${message}`
      : message;
    const ai = new GoogleGenAI({ apiKey });
    const geminiStartedAt = Date.now();
    const interaction = await ai.interactions.create(
      {
        model: 'gemini-3.1-flash-lite',
        input,
        store: false,
        system_instruction: `${SYSTEM_PROMPT}\n\nFecha y hora actual en Ecuador: ${getEcuadorDateTime()}.`,
        generation_config: { max_output_tokens: 450, temperature: 0.4 },
      },
      { timeout: GEMINI_TIMEOUT_MS },
    );

    const response = interaction.output_text?.trim();
    if (!response) {
      return jsonResponse({ success: false, error: 'El asistente no generó una respuesta. Intenta nuevamente.' }, 502);
    }

    console.info('Chat request completed', {
      totalMs: Date.now() - startedAt,
      geminiMs: Date.now() - geminiStartedAt,
      contextItems: context.length,
      status: 'ok',
    });
    return jsonResponse({ success: true, response });
  } catch (error: unknown) {
    const status = typeof error === 'object' && error && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : undefined;
    console.error('Chat request failed', {
      totalMs: Date.now() - startedAt,
      status: status || 'error',
      timeout: isTimeout(error),
    });

    if (status === 429) {
      return jsonResponse({ success: false, error: 'El servicio está temporalmente ocupado. Intenta de nuevo en unos segundos.' }, 429);
    }
    if (isTimeout(error)) {
      return jsonResponse({ success: false, error: 'Vaco tardó demasiado en responder. Intenta nuevamente.' }, 504);
    }
    return jsonResponse({ success: false, error: 'Lo siento, tuve un problema al procesar tu mensaje. Intenta nuevamente.' }, 500);
  }
};
