# Creado por Rogelio Emmanuel Ceja Acosta

# Music Reproductor

Reproductor web local construido con Vite, React y TypeScript. La biblioteca combina las canciones de demo incluidas al compilar el proyecto con archivos que se importan desde el navegador.

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

Para probar en local, coloca archivos en `src/assets/music/`. Esa carpeta esta ignorada por git: la musica **nunca** se sube al repositorio ni al deploy.

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

## Publicar en Railway

El servicio de Railway compila con `npm run build` y sirve la carpeta `dist`.

1. En el servicio: **Variables** → `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Vite las incrusta al compilar, asi que cualquier cambio requiere un nuevo deploy.
2. En Supabase, **Authentication → URL Configuration**: el dominio de Railway como `Site URL` y en las URLs de redireccion permitidas.

La clave publishable puede estar en el frontend; nunca agregues una `service_role` o `secret key`. Consulta `SUPABASE.md` para crear el proyecto, aplicar las migraciones y probar registro e inicio de sesion. El plan de desarrollo esta en `PLAN.md` y la auditoria en `SECURITY_AUDIT.md`.
