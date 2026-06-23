# Forense Web

Frontend de la plataforma de análisis forense de archivos APK. Proporciona una interfaz moderna y responsive para subir aplicaciones Android, visualizar el historial de análisis y consultar el panel de hallazgos.

## Tech Stack

| Tecnología | Uso |
|------------|-----|
| **Next.js 16.2.9** | Framework React con App Router |
| **React 19** | Biblioteca de UI |
| **TypeScript** | Tipado estático |
| **Tailwind CSS v4** | Estilos utilitarios |
| **next-intl** | Internacionalización (i18n) |
| **Recharts** | Gráficos y visualizaciones de datos |
| **Radix UI** | Primitives para componentes accesibles |
| **Lucide React** | Iconografía |

## Prerrequisitos

- **Node.js 20+**
- **npm** (incluido con Node.js)

## Setup paso a paso

1. **Instalar dependencias**

   ```bash
   npm install
   ```

2. **Configurar variables de entorno**

   Crea un archivo `.env.local` en la raíz de `web/`:

   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

   Esta variable apunta a la URL del backend FastAPI.

3. **Iniciar el servidor de desarrollo**

   ```bash
   npm run dev
   ```

   La aplicación estará disponible en `http://localhost:3000`.

4. **Compilar para producción**

   ```bash
   npm run build
   ```

5. **Iniciar en modo producción**

   ```bash
   npm start
   ```

## Estructura del proyecto

```
web/
├── src/
│   ├── app/
│   │   ├── [locale]/           # Rutas localizadas (es, en)
│   │   │   ├── page.tsx        # Página de carga de APK
│   │   │   ├── history/
│   │   │   │   └── page.tsx    # Historial de análisis
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx    # Panel de hallazgos
│   │   │   └── layout.tsx      # Layout con sidebar y header
│   │   ├── globals.css         # Estilos globales y tokens del design system
│   │   └── page.tsx            # Redirección al locale por defecto
│   ├── components/
│   │   ├── sidebar.tsx         # Navegación lateral
│   │   ├── header.tsx          # Header con selector de idioma
│   │   └── ui/                 # Componentes reutilizables (Button, Card, Table, Badge, etc.)
│   ├── i18n/
│   │   ├── request.ts          # Configuración de carga de mensajes
│   │   └── routing.ts          # Definición de locales y rutas
│   ├── messages/
│   │   ├── es.json             # Traducciones en español
│   │   └── en.json             # Traducciones en inglés
│   └── lib/
│       └── utils.ts            # Utilidades (cn para clases condicionales)
├── public/                     # Assets estáticos
├── middleware.ts               # Middleware de next-intl para enrutamiento i18n
├── next.config.ts              # Configuración de Next.js (output: standalone)
├── tailwind.config.ts          # Configuración de Tailwind CSS
└── package.json
```

## Internacionalización (i18n)

La aplicación soporta dos idiomas:

- **Español (es)** - Idioma por defecto
- **Inglés (en)**

### Cómo funciona

- `next-intl` gestiona las traducciones mediante archivos JSON en `src/messages/`.
- Las rutas incluyen el locale: `/es/history`, `/en/dashboard`.
- El middleware (`middleware.ts`) redirige automáticamente al locale por defecto si no se especifica.
- El usuario puede cambiar de idioma desde el selector en el header.

### Agregar nuevas traducciones

1. Edita `src/messages/es.json` y `src/messages/en.json`.
2. Usa `useTranslations()` o `getTranslations()` en los componentes para acceder a las claves.

## Design System

El proyecto sigue el sistema de diseño definido en [`design.md`](../design.md) ubicado en la raíz del repositorio.

Aspectos clave:
- **Paleta de colores**: Tema oscuro con acentos en azul eléctrico, verde matrix y semáforo de severidad (rojo, amarillo, verde).
- **Tipografía**: Inter para UI, JetBrains Mono para datos técnicos.
- **Layout**: Grid de 12 columnas, sidebar fijo de 240px en desktop, 64px en tablet.
- **Componentes**: Botones con radio 4px, badges en forma de píldora, tablas con striping sutil.

## Páginas y rutas disponibles

| Ruta | Descripción |
|------|-------------|
| `/` | Redirige a `/es` (locale por defecto) |
| `/[locale]` | Página principal: carga de archivos APK |
| `/[locale]/history` | Historial de análisis con tabla paginada |
| `/[locale]/dashboard` | Panel con estadísticas y hallazgos recientes |

> Nota: `[locale]` puede ser `es` o `en`.

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia el servidor de desarrollo con Turbopack |
| `npm run build` | Compila la aplicación para producción |
| `npm start` | Inicia el servidor de producción (requiere build previo) |
| `npm run lint` | Ejecuta ESLint para análisis estático de código |

## Troubleshooting

### Error `Module not found` al iniciar

- Asegúrate de haber ejecutado `npm install`.
- Elimina `node_modules` y el lockfile, luego reinstala:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```

### La API no responde desde el frontend

- Verifica que `NEXT_PUBLIC_API_URL` en `.env.local` apunte a la URL correcta del backend.
- Confirma que el backend FastAPI esté corriendo en `http://localhost:8000`.
- Revisa que CORS esté habilitado en el backend.

### Problemas con Tailwind CSS v4

- Tailwind v4 usa PostCSS directamente. No edites `tailwind.config.ts` como en versiones anteriores; la configuración puede estar en `globals.css` o en el plugin de PostCSS.
- Si los estilos no se aplican, revisa `postcss.config.mjs`.

### Errores de TypeScript

- Ejecuta `npx tsc --noEmit` para verificar errores de tipado.
- Asegúrate de que `@types/react` y `@types/react-dom` estén actualizados.

### next-intl no detecta el locale

- Verifica que `middleware.ts` esté en la raíz de `web/` (no dentro de `src/`).
- Revisa que `src/i18n/routing.ts` defina correctamente `locales` y `defaultLocale`.
