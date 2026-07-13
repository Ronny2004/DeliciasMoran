import type { APIRoute } from 'astro';

export const prerender = false;

interface ReservationData {
  name: string;
  phone: string;
  date: string;
  time: string;
  people: number;
  dishes?: string;
  notes?: string;
}

function formatReservationMessage(data: ReservationData): string {
  return `🔔 *NUEVA RESERVA*
🏪 Las Delicias de Morán
${'─'.repeat(30)}
👤 *Nombre:* ${data.name}
📱 *Teléfono:* ${data.phone}
📅 *Fecha:* ${data.date}
⏰ *Hora:* ${data.time}
👥 *Personas:* ${data.people}
${data.dishes ? `🍽️ *Platos:* ${data.dishes}` : ''}
${data.notes ? `📝 *Notas:* ${data.notes}` : ''}
${'─'.repeat(30)}`;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const data: ReservationData = await request.json();

    const botToken = import.meta.env.TELEGRAM_BOT_TOKEN;
    const ownerChatId = import.meta.env.TELEGRAM_OWNER_CHAT_ID;

    if (!botToken || !ownerChatId) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Reserva recibida. Nos pondremos en contacto contigo pronto.',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ownerMessage = formatReservationMessage(data);

    const ownerRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ownerChatId,
        text: ownerMessage,
        parse_mode: 'Markdown',
      }),
    });

    if (!ownerRes.ok) {
      const err = await ownerRes.json().catch(() => ({}));
      console.error('Failed to notify owner:', err);
    }

    return new Response(JSON.stringify({
      success: true,
      message: '¡Reserva confirmada! Te hemos enviado un resumen. Nos vemos pronto.',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Reservation API error:', error);
    return new Response(JSON.stringify({ error: 'Error al procesar la reserva' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const GET: APIRoute = async ({ url }) => {
  const webhookUrl = `${url.origin}/api/telegram-webhook`;
  const botToken = import.meta.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return new Response(JSON.stringify({ error: 'Bot token no configurado' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl }),
  });

  const result = await res.json();
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
