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
const MAX_HISTORY_ITEMS = 20;
const MAX_HISTORY_TEXT_LENGTH = 2_000;
const MAX_HISTORY_TOTAL_LENGTH = 12_000;
const MAX_BODY_SIZE = 50_000;
const CHAT_RATE_LIMIT = 12;
const CHAT_RATE_WINDOW_MS = 60_000;

interface ChatPart {
  text: string;
}

interface ChatHistoryItem {
  role: 'user' | 'model';
  parts: ChatPart[];
}

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

function parseHistory(value: unknown): ChatHistoryItem[] | null {
  if (!Array.isArray(value) || value.length > MAX_HISTORY_ITEMS) return null;

  let totalLength = 0;
  const history: ChatHistoryItem[] = [];

  for (const item of value) {
    if (
      !item
      || (item.role !== 'user' && item.role !== 'model')
      || !Array.isArray(item.parts)
      || item.parts.length !== 1
      || typeof item.parts[0]?.text !== 'string'
    ) {
      return null;
    }

    const text = item.parts[0].text.trim();
    if (!text || text.length > MAX_HISTORY_TEXT_LENGTH) return null;

    totalLength += text.length;
    if (totalLength > MAX_HISTORY_TOTAL_LENGTH) return null;

    history.push({ role: item.role, parts: [{ text }] });
  }

  return history;
}

export const POST: APIRoute = async ({ request }) => {
  if (!isAllowedOrigin(request)) {
    return jsonResponse({ success: false, error: 'Origen no permitido.' }, 403);
  }

  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit(
    `chat:${clientIp}`,
    CHAT_RATE_LIMIT,
    CHAT_RATE_WINDOW_MS,
  );
  if (!rateLimit.allowed) {
    return jsonResponse(
      {
        success: false,
        error: 'Has enviado demasiados mensajes. Espera un momento e intenta nuevamente.',
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
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const history = parseHistory(body?.history);

    if (!message) {
      return jsonResponse({ success: false, error: 'Escribe un mensaje para continuar.' }, 400);
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return jsonResponse(
        {
          success: false,
          error: `El mensaje no puede superar los ${MAX_MESSAGE_LENGTH} caracteres.`,
        },
        400,
      );
    }
    if (!history) {
      return jsonResponse({ success: false, error: 'El historial del chat no es válido.' }, 400);
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

    const apiKey = import.meta.env.GEMINI_API_KEY;
    if (!apiKey) {
      return jsonResponse(
        { success: false, error: 'El asistente no está configurado temporalmente.' },
        503,
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const chat = ai.chats.create({
      model: 'gemini-3.1-flash-lite',
      history,
      config: {
        systemInstruction: `${SYSTEM_PROMPT}\n\nFecha y hora actual en Ecuador: ${getEcuadorDateTime()}.`,
      },
    });

    const result = await chat.sendMessage({ message });
    const response = result.text?.trim();
    if (!response) {
      return jsonResponse(
        { success: false, error: 'El asistente no generó una respuesta. Intenta nuevamente.' },
        502,
      );
    }

    return jsonResponse({ success: true, response });
  } catch (error: any) {
    console.error('Chat API error:', error?.message || error);

    if (error?.status === 429) {
      return jsonResponse(
        {
          success: false,
          error: 'El servicio está temporalmente ocupado. Intenta de nuevo en unos segundos.',
        },
        429,
      );
    }

    return jsonResponse(
      {
        success: false,
        error: 'Lo siento, tuve un problema al procesar tu mensaje. Intenta nuevamente.',
      },
      500,
    );
  }
};
