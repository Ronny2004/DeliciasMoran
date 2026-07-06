# Las Delicias de Morán

Sitio web premium de una sola página (One Page) para el emblemático restaurante tradicional ecuatoriano **"Las Delicias de Morán"**.

## Características Principales

- **📖 Menú de Pergamino Interactivo**: Una experiencia única donde la carta se despliega como un pergamino antiguo, con tipografía caligráfica elegante y detalles de platos desplegables.
- **📱 Optimización Móvil Total**: Diseño fluido que se adapta perfectamente a cualquier dispositivo.
- **🎨 Estética "Hueca" Premium**: Colores cálidos (crema, terracota, madera) que evocan la tradición y el hogar.
- **🔗 Integración con WhatsApp**: Enlaces directos para unirse al grupo de la comunidad y pedidos.
- **🗺️ Ubicación en Vivo**: Mapa interactivo integrado para facilitar la llegada de los clientes.
- **🔐 Portal de Empleados**: Acceso discreto para la gestión interna del restaurante.

## Tecnologías Utilizadas

- **[Astro](https://astro.build/)**: Framework de alto rendimiento para sitios estáticos.
- **HTML5 & CSS3**: Estructura semántica y animaciones suaves personalizadas.
- **JavaScript Moderno**: Lógica interactiva para el menú modal y efectos de acordeón.
- **Google Fonts**: 
  - `Lora`: Para títulos con herencia.
  - `Inter`: Para una lectura cómoda del cuerpo de texto.
  - `Great Vibes`: Para el toque artesanal y elegante del menú.
- **Lucide Icons**: Iconografía moderna y minimalista.

## 🚀 Inicio Rápido

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Iniciar servidor de desarrollo**:
   ```bash
   npm run dev
   ```
   Accede a `http://localhost:4321/` en tu navegador.

3. **Construir para producción**:
   ```bash
   npm run build
   ```

## 📁 Estructura del Proyecto

```text
delicias-moran-web/
├── public/
│   ├── assets/           # Imágenes y logo
│   └── style.css         # Estilos globales y del modal
├── src/
│   └── pages/
│       └── index.astro   # Estructura principal y lógica JS
├── astro.config.mjs      # Configuración de Astro
└── package.json          # Dependencias y scripts
```

---
© 2026 Las Delicias de Morán. Desarrollado con ❤️ para la tradición ecuatoriana.
