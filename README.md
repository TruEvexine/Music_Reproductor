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

## Canciones de demo

Coloca los archivos de demo en `src/assets/music/`. Se incluyen en el build y se detectan automaticamente. Se leen metadatos de MP3, WAV, FLAC y M4A.

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

El proyecto usa Vite; Vercel detecta automaticamente el comando `npm run build` y la carpeta `dist`.

1. Importa el repositorio en Vercel.
2. Agrega las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en **Project Settings → Environment Variables** para Preview y Production.
3. Despues del deploy, configura en Supabase **Authentication → URL Configuration** el dominio de produccion como `Site URL` y agregalo a las URLs de redireccion permitidas.
4. Despliega nuevamente despues de cambiar variables de entorno.

Las demos se sirven como archivos estaticos separados. Actualmente suman unos 352 MB; la primera descarga de una pista grande puede tardar dependiendo de la conexion. La clave publishable puede estar en el frontend; nunca agregues una `service_role` o `secret key`.

El archivo local `.env` ya tiene la URL del proyecto y la publishable key para desarrollo. Consulta `SUPABASE.md` para revisar/aplicar las migraciones y probar registro e inicio de sesion antes de publicar.