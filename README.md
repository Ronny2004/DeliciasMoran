# Las Delicias de Morán — Web

Sitio web oficial del restaurante **Las Delicias de Morán**, cocina tradicional ecuatoriana en Quito.

## Funcionalidades

- **Menú interactivo** — Modal con estilo pergaminos, platos expandibles con ingredientes y precios
- **Chat con Gemini** — Asistente virtual "Vaco 🐮" que conoce el menú y asesora a los clientes
- **Sistema de reservas** — El chat recolecta datos y notifica al dueño por Telegram
- **Mapa interactivo** — Ubicación con Google Maps embebido
- **Diseño responsive** — Adaptado a móvil, tablet y escritorio

## Tech Stack

| Tecnología | Rol |
|---|---|
| Astro v6 | Framework estático + SSR híbrido |
| TypeScript | Tipado estricto |
| @astrojs/node | Adaptador de servidor para Vercel |
| Google Gemini API | Asistente IA del chat |
| Telegram Bot API | Notificaciones de reservas |

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
│   └── restaurant-info.ts  — System prompt del chatbot
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
```

Nunca subir `.env` a git (ya está en `.gitignore`).

## Desarrollo Local

```bash
npm install
npm run dev
```

El servidor arranca en `http://localhost:4321/`.

## Despliegue en Vercel

Ver la sección [Despliegue en Vercel](#despliegue-en-vercel) más abajo.

---

## Despliegue en Vercel — Paso a Paso

### 1. Preparar el repositorio

```bash
git init
git add .
git commit -m "Initial commit"
```

Subir a GitHub, GitLab o Bitbucket.

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

**Importante:** En Vercel, las variables de entorno se pueden configurar también después en **Settings → Environment Variables**.

### 5. Configurar el build

En **Settings → General**:

- **Framework Preset:** Astro
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

### 6. Deploy

Hacer clic en **"Deploy"**. Vercel:
1. Instalará las dependencias
2. Compilará el proyecto
3. Generará una URL pública

### 7. Verificar

1. Abrir la URL generada
2. Probar el chat (el botón flotante de la esquina inferior derecha)
3. Hacer una prueba de reserva
4. Verificar que llega el mensaje de Telegram al dueño

### Variables de entorno en producción

| Variable | Dónde obtenerla |
|---|---|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) |
| `TELEGRAM_BOT_TOKEN` | [@BotFather](https://t.me/BotFather) en Telegram |
| `TELEGRAM_OWNER_CHAT_ID` | Envía `/start` al bot → visita `https://api.telegram.org/bot<TOKEN>/getUpdates` |

---

## Créditos

Desarrollado por **Equipo DM** — ronnypallo8@gmail.com
