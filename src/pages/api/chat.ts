import type { APIRoute } from 'astro';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SYSTEM_PROMPT } from '../../lib/restaurant-info';

export const prerender = false;

const genAI = new GoogleGenerativeAI(import.meta.env.GEMINI_API_KEY);

function getEcuadorDateTime(): string {
  const now = new Date();
  const ecuadorTime = new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);
  return ecuadorTime;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { message, history } = await request.json();

    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

    const now = getEcuadorDateTime();

    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: `Fecha y hora actual en Ecuador: ${now}. Usa esta información para interpretar "hoy", "mañana", "esta noche", etc. Aquí está la información completa del restaurante para que actúes como asistente virtual:` }],
        },
        {
          role: 'model',
          parts: [{ text: SYSTEM_PROMPT }],
        },
        ...(history || []),
      ],
    });

    const result = await chat.sendMessage(message);
    const response = result.response.text();

    return new Response(JSON.stringify({ response }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Chat API error:', error?.message || error);

    if (error?.status === 429) {
      return new Response(JSON.stringify({
        error: 'El servicio está temporalmente ocupado. Por favor, intenta de nuevo en unos segundos.',
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      error: 'Lo siento, tuve un problema al procesar tu mensaje. Por favor, intenta de nuevo.',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
