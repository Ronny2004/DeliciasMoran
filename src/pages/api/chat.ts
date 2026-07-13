import type { APIRoute } from 'astro';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SYSTEM_PROMPT } from '../../lib/restaurant-info';

export const prerender = false;

const genAI = new GoogleGenerativeAI(import.meta.env.GEMINI_API_KEY);

export const POST: APIRoute = async ({ request }) => {
  try {
    const { message, history } = await request.json();

    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: 'Actúa como el asistente virtual de este restaurante. Aquí está toda la información que necesitas:' }],
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
