# Las Delicias de Morán — Web

Sitio web oficial del restaurante **Las Delicias de Morán**, cocina tradicional ecuatoriana en Quito.

## Funcionalidades

- **Menú interactivo** — Modal con estilo pergaminos, platos expandibles con ingredientes y precios
- **Chat con Gemini** — Asistente virtual "Vaco 🐮" que conoce el menú y asesora a los clientes
- **Sistema de reservas** — El chat recolecta datos y notifica al dueño por Telegram
- **Protección de API** — Turnstile, validación de origen, límites por IP y tamaños máximos
- **Entrega confiable** — Una reserva solo se confirma cuando Telegram acepta la notificación
- **Mapa interactivo** — Ubicación con Google Maps embebido
- **Diseño responsive** — Adaptado a móvil, tablet y escritorio
- **Imágenes optimizadas** — Recursos WebP preparados para producción

## Tech Stack

| Tecnología | Rol |
|---|---|
| Astro v7 | Framework estático + SSR híbrido |
| TypeScript | Tipado estricto |
| @astrojs/vercel | Adaptador de servidor para Vercel |
| @google/genai | SDK de Gemini para el asistente |
| Telegram Bot API | Notificaciones de reservas |
| Cloudflare Turnstile | Protección antispam |

## Estructura del Proyecto

```
src/
├── components/
│   ├── Header.astro        — Barra de navegación fija
│   ├── Hero.astro          — Sección principal con CTAs
│   ├── Ubicacion.astro     — Mapa de Google Maps embebido
│   ├── Herencia.astro      — Sección "Nuestra Herencia"
│   ├── Footer.astro        — Footer con contacto y links
│   ├── MenuModal.astro     — Modal del menú con acordeón
│   └── GeminiChat.astro    — Widget de chat con Gemini
├── layouts/
│   └── Layout.astro        — Shell HTML base
├── lib/
│   ├── restaurant-info.ts  — System prompt del chatbot
│   └── api-security.ts     — Origen, rate limiting y Turnstile
├── pages/
│   ├── index.astro         — Página principal
│   └── api/
│       ├── chat.ts         — Proxy a Gemini API
│       └── reservation.ts  — Notificaciones Telegram
└── styles/
    └── global.css          — Variables CSS, animaciones, utilidades
```

## Variables de Entorno

Crea un archivo `.env` en la raíz:

```env
GEMINI_API_KEY=tu_api_key_de_gemini
TELEGRAM_BOT_TOKEN=tu_token_del_bot
TELEGRAM_OWNER_CHAT_ID=tu_chat_id
PUBLIC_TURNSTILE_SITE_KEY=tu_site_key_publica
TURNSTILE_SECRET_KEY=tu_secret_key_privada
ALLOWED_ORIGINS=https://tudominio.com
```

`ALLOWED_ORIGINS` es opcional. El dominio actual se permite automáticamente; úsala únicamente para autorizar dominios adicionales, separados por comas.

Nunca subir `.env` a Git: ya está cubierto por `.gitignore`. Solo `PUBLIC_TURNSTILE_SITE_KEY` puede llegar al navegador; las demás credenciales permanecen en el servidor.

## Desarrollo Local

```bash
npm install
npm run dev
```

El servidor arranca en `http://localhost:4321/`.

Antes de enviar cambios:

```bash
npm run check
npm run build
```

Se recomienda Node.js 24, que coincide con el runtime utilizado por las funciones de Vercel.

---

## Despliegue en Vercel — Paso a Paso

### 1. Subir los cambios

```bash
git add .
git commit -m "feat: preparar sitio para producción"
git push
```

### 2. Crear cuenta en Vercel

Ir a [vercel.com](https://vercel.com) y crear cuenta (se puede con GitHub).

### 3. Importar el proyecto

1. En el dashboard de Vercel, hacer clic en **"Add New..."** → **"Project"**
2. Seleccionar el repositorio
3. Vercel detectará automáticamente Astro

### 4. Configurar variables de entorno

En la pantalla de configuración del proyecto, agregar:

| Variable | Valor |
|---|---|
| `GEMINI_API_KEY` | Tu API key de Google AI Studio |
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram (@BotFather) |
| `TELEGRAM_OWNER_CHAT_ID` | Tu chat ID de Telegram |
| `PUBLIC_TURNSTILE_SITE_KEY` | Site key pública de Cloudflare Turnstile |
| `TURNSTILE_SECRET_KEY` | Secret key privada de Cloudflare Turnstile |
| `ALLOWED_ORIGINS` | Dominios adicionales permitidos, separados por coma (opcional) |

**Importante:** En Vercel, las variables de entorno se pueden configurar también después en **Settings → Environment Variables**.

### 5. Configurar Cloudflare Turnstile

1. Crear un widget en [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile).
2. Agregar el hostname de producción sin protocolo ni rutas, por ejemplo `deliciasmoran.vercel.app`.
3. Agregar `localhost` si se harán pruebas locales.
4. Seleccionar el modo **Invisible**.
5. Copiar la Site Key y Secret Key a Vercel.

La Secret Key nunca debe usar el prefijo `PUBLIC_`.

### 6. Configurar el build

En **Settings → General**:

- **Framework Preset:** Astro
- **Build Command:** `npm run build`
- **Install Command:** `npm install`

No es necesario sobrescribir manualmente el directorio de salida cuando Vercel detecta Astro.

### 7. Deploy

Hacer clic en **"Deploy"**. Vercel:

1. Instalará las dependencias
2. Compilará el proyecto
3. Generará una URL pública

### 8. Verificar

1. Abrir la URL generada
2. Probar el chat (el botón flotante de la esquina inferior derecha)
3. Hacer una prueba de reserva
4. Verificar que llega el mensaje de Telegram al dueño
5. Confirmar que el cliente recibe éxito únicamente cuando Telegram responde correctamente

## Protecciones implementadas

- Chat: máximo 12 solicitudes por minuto por IP.
- Reservas: máximo 3 intentos cada 10 minutos por IP.
- Mensajes: máximo 500 caracteres.
- Historial: máximo 20 turnos y 12.000 caracteres.
- Turnstile validado en el servidor en cada solicitud.
- Comprobación del hostname, acción y origen.
- Reservas validadas por fecha, horario, teléfono y número de personas.
- Respuestas con `Cache-Control: no-store`.
- Timeouts para Turnstile y Telegram.

El rate limiting en memoria funciona por instancia activa. Para límites globales entre todas las instancias de Vercel se requiere Redis/KV o una regla de Vercel Firewall.

### Variables de entorno en producción

| Variable | Dónde obtenerla |
|---|---|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) |
| `TELEGRAM_BOT_TOKEN` | [@BotFather](https://t.me/BotFather) en Telegram |
| `TELEGRAM_OWNER_CHAT_ID` | Envía `/start` al bot → visita `https://api.telegram.org/bot<TOKEN>/getUpdates` |
| `PUBLIC_TURNSTILE_SITE_KEY` | Widget creado en [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) |
| `TURNSTILE_SECRET_KEY` | El mismo widget de Cloudflare Turnstile |
| `ALLOWED_ORIGINS` | Solo si se necesitan dominios adicionales |

---

## Créditos

Desarrollado por **Equipo DM** — ronnypallo8@gmail.com
