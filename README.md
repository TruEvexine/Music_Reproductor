# Creado por Rogelio Emmanuel Ceja Acosta

# Music Reproductor

Reproductor web local construido con Vite, React y TypeScript. La musica se importa desde el navegador y nunca sale del dispositivo.

## Requisitos

- Node.js 22.12 o superior
- npm

## Iniciar

```bash
npm install
npm run dev
```

Crear una compilacion de produccion con:

```bash
npm run build
```

## Canciones de prueba

Para probar en local, coloca archivos en `src/assets/music/`. Esa carpeta esta ignorada por git y solo se carga con `npm run dev`: la musica **nunca** se sube al repositorio ni entra en un build.

Tambien se pueden agregar canciones desde la interfaz. Sus metadatos se leen localmente y los archivos no se suben a un servidor. La reproduccion depende del navegador y del sistema operativo; el soporte de FLAC/M4A puede variar.

La aplicacion web no puede explorar por su cuenta una carpeta del ordenador ni detectar cambios posteriores en ella. Para la biblioteca local personal, importa los archivos mediante el selector de la aplicacion.

## Estructura inicial

```text
src/
  app/                 Aplicacion y composicion de pantallas
  assets/music/        Canciones de demo incluidas en el build
  features/library/    Catalogo y modelo de canciones
  features/player/     Estado y controles de reproduccion
  styles/              Estilos globales
public/                Archivos estaticos publicos
```

La cola es independiente de las playlists: utiliza el boton **+** en cada cancion para agregarla sin iniciar su reproduccion. Desde el reproductor se puede abrir, reordenar y limpiar.

## Publicar en Vercel

El proyecto de Vercel compila con `npm run build` y sirve `dist`. `main` es produccion; las demas ramas generan previews. Las cabeceras de seguridad estan en `vercel.json`.

1. **Settings → Environment Variables**: `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (Production y Preview). Vite las incrusta al compilar: cualquier cambio requiere un nuevo deploy.
2. En Supabase, **Authentication → URL Configuration**: el dominio de Vercel como `Site URL` y en las URLs de redireccion permitidas.

La clave publishable puede estar en el frontend; nunca agregues una `service_role` o `secret key` (el build falla si la detecta). El plan esta en `PLAN.md`, la auditoria en `SECURITY_AUDIT.md` y lo que depende de ti en `DECISIONES_PENDIENTES.md`.

## Desarrollo

```bash
npm run setup        # una vez por clon: activa los hooks de git (.githooks/)
npm run typecheck
npm test             # Vitest
npm run test:audio   # genera audio sintetico de prueba (ffmpeg opcional)
```

Los hooks bloquean commits con `.env`, audio, keystores, archivos de mas de 2 MB o patrones de secretos.
