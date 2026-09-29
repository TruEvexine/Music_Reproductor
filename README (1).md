# Music Player — Setup & Public Demo

## 1. ¿Qué necesito hacer yo?

Para levantar el proyecto lo más rápido posible, el orden recomendado es:

```text
1. Crear proyecto en Supabase
2. Crear las tablas
3. Copiar URL + Publishable Key
4. Configurar variables de entorno
5. Instalar dependencias
6. Ejecutar localmente
7. Probar login + reproducción
8. Publicar en Vercel
9. Configurar la URL pública en Supabase Auth
```

La idea es que **Supabase maneje autenticación y datos remotos**, mientras que la música local y el reproductor siguen siendo responsabilidad de la aplicación.

---

# 2. Requisitos

Instalar:

- Node.js LTS
- npm
- Git, si el proyecto está en un repositorio
- Una cuenta de Supabase
- Una cuenta de Vercel para publicar

No necesitas montar un servidor propio para el MVP.

---

# 3. Crear el proyecto en Supabase

Entrar a:

urlSupabasehttps://supabase.com/

Crear un proyecto nuevo.

Al terminar, necesitarás:

```text
Project URL
Publishable Key
```

Supabase actualmente recomienda utilizar las claves `publishable` para código que llega al dispositivo del usuario; las claves secretas/administrativas deben permanecer exclusivamente en backend. citeturn0search8turn0search9

## Dónde encontrarlas

En el proyecto de Supabase:

```text
Connect
```

o:

```text
Settings
→ API Keys
```

La propia documentación de Supabase indica que el diálogo Connect proporciona la URL y la publishable key. citeturn0search8

---

# 4. Crear las tablas rápidamente

## Opción recomendada: SQL Editor

En Supabase:

```text
SQL Editor
→ New query
```

Pegar el siguiente SQL completo y ejecutar.

```sql
-- =========================================================
-- MUSIC PLAYER - DATABASE SETUP
-- =========================================================

create extension if not exists pgcrypto;

-- =========================================================
-- PROFILES
-- =========================================================

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text,
    avatar_url text,
    created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile"
on public.profiles;

create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can insert own profile"
on public.profiles;

create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can update own profile"
on public.profiles;

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);


-- =========================================================
-- PLAYLISTS
-- =========================================================

create table if not exists public.playlists (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    created_at timestamptz not null default now()
);

alter table public.playlists enable row level security;

drop policy if exists "Users can view own playlists"
on public.playlists;

create policy "Users can view own playlists"
on public.playlists
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create own playlists"
on public.playlists;

create policy "Users can create own playlists"
on public.playlists
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own playlists"
on public.playlists;

create policy "Users can update own playlists"
on public.playlists
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own playlists"
on public.playlists;

create policy "Users can delete own playlists"
on public.playlists
for delete
to authenticated
using (auth.uid() = user_id);


-- =========================================================
-- PLAYLIST TRACKS
-- =========================================================

create table if not exists public.playlist_tracks (
    id uuid primary key default gen_random_uuid(),
    playlist_id uuid not null references public.playlists(id) on delete cascade,
    track_identifier text not null,
    position integer not null default 0,
    created_at timestamptz not null default now()
);

alter table public.playlist_tracks enable row level security;

drop policy if exists "Users can view own playlist tracks"
on public.playlist_tracks;

create policy "Users can view own playlist tracks"
on public.playlist_tracks
for select
to authenticated
using (
    exists (
        select 1
        from public.playlists p
        where p.id = playlist_tracks.playlist_id
        and p.user_id = auth.uid()
    )
);

drop policy if exists "Users can create own playlist tracks"
on public.playlist_tracks;

create policy "Users can create own playlist tracks"
on public.playlist_tracks
for insert
to authenticated
with check (
    exists (
        select 1
        from public.playlists p
        where p.id = playlist_tracks.playlist_id
        and p.user_id = auth.uid()
    )
);

drop policy if exists "Users can update own playlist tracks"
on public.playlist_tracks;

create policy "Users can update own playlist tracks"
on public.playlist_tracks
for update
to authenticated
using (
    exists (
        select 1
        from public.playlists p
        where p.id = playlist_tracks.playlist_id
        and p.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.playlists p
        where p.id = playlist_tracks.playlist_id
        and p.user_id = auth.uid()
    )
);

drop policy if exists "Users can delete own playlist tracks"
on public.playlist_tracks;

create policy "Users can delete own playlist tracks"
on public.playlist_tracks
for delete
to authenticated
using (
    exists (
        select 1
        from public.playlists p
        where p.id = playlist_tracks.playlist_id
        and p.user_id = auth.uid()
    )
);


-- =========================================================
-- INDEXES
-- =========================================================

create index if not exists playlists_user_id_idx
on public.playlists(user_id);

create index if not exists playlist_tracks_playlist_id_idx
on public.playlist_tracks(playlist_id);

create index if not exists playlist_tracks_position_idx
on public.playlist_tracks(playlist_id, position);
```

Después de ejecutar el query, comprobar en:

```text
Table Editor
```

que aparezcan:

```text
profiles
playlists
playlist_tracks
```

Supabase recomienda proteger las tablas mediante RLS antes de exponerlas al cliente. citeturn0search8turn0search2

---

# 5. Crear automáticamente el perfil después del registro

Para el MVP se puede hacer desde la aplicación después de registrarse.

Flujo:

```text
signUp()
↓
usuario creado
↓
insert en profiles
↓
app
```

No es obligatorio crear un trigger de PostgreSQL para el primer MVP.

Esto reduce complejidad.

---

# 6. Autenticación

En Supabase:

```text
Authentication
→ Providers
→ Email
```

Activar Email/Password.

El flujo inicial será:

```text
Registro
Login
Logout
Persistencia de sesión
```

Supabase mantiene la sesión del cliente cuando se configura el cliente con su comportamiento de persistencia correspondiente. citeturn0search1turn0search0

---

# 7. Conectar el proyecto con Supabase

Instalar el cliente:

```bash
npm install @supabase/supabase-js
```

La instalación de `@supabase/supabase-js` es la vía oficial para utilizar Supabase desde JavaScript/TypeScript. citeturn0search2

Crear:

```text
.env
```

o el archivo de variables de entorno correspondiente al framework.

Ejemplo genérico:

```env
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_PUBLISHABLE_KEY=TU_PUBLISHABLE_KEY
```

Para frontend, el nombre concreto de las variables debe adaptarse al framework:

### Vite

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

### Next.js

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

No copiar literalmente las variables de Vite en Next.js ni al revés.

---

# 8. Cliente Supabase

La implementación deberá centralizar el cliente.

Conceptualmente:

```ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
)
```

La documentación oficial utiliza `createClient(URL, publishableKey)` para inicializar el cliente. citeturn0search0

---

# 9. Probar conexión

Una prueba rápida:

```ts
const { data, error } = await supabase
    .from('profiles')
    .select('*')

console.log(data)
console.error(error)
```

Si aparece:

```text
[]
```

sin error, la conexión y permisos básicos están funcionando.

Si aparece un error de RLS, revisar las policies.

---

# 10. Probar registro

Conceptualmente:

```ts
const { data, error } = await supabase.auth.signUp({
    email,
    password
})
```

Después:

```text
Authentication
→ Users
```

deberá mostrar el usuario creado.

---

# 11. Probar login

```ts
const { data, error } =
    await supabase.auth.signInWithPassword({
        email,
        password
    })
```

Después comprobar:

```ts
const {
    data: { user }
} = await supabase.auth.getUser()
```

---

# 12. Probar playlist

Después de iniciar sesión:

```ts
const {
    data: { user }
} = await supabase.auth.getUser()

await supabase
    .from('playlists')
    .insert({
        user_id: user.id,
        name: 'Mi playlist'
    })
```

La tabla deberá recibir el registro.

La API JavaScript de Supabase permite insertar registros mediante `.from(...).insert(...)`. citeturn0search11

---

# 13. Supabase CLI — opcional

No necesitas la CLI para crear el proyecto si quieres ir rápido.

Pero es recomendable incorporarla posteriormente para mantener las migraciones del proyecto.

Instalar:

```bash
npm install -D supabase
```

o utilizar la instalación de CLI recomendada para tu sistema.

Después:

```bash
npx supabase login
```

Inicializar:

```bash
npx supabase init
```

Vincular el proyecto:

```bash
npx supabase link --project-ref TU_PROJECT_REF
```

El `project-ref` corresponde al identificador del proyecto de Supabase. La documentación oficial también permite obtenerlo desde la URL del Dashboard. citeturn0search16

Crear una migración:

```bash
npx supabase migration new initial_music_player
```

Después colocar el SQL correspondiente en:

```text
supabase/migrations/
```

Y aplicar:

```bash
npx supabase db push
```

Supabase documenta `supabase link` y `supabase db push` como el flujo para asociar el proyecto local con el remoto y aplicar migraciones. citeturn0search13turn0search14

---

# 14. ¿Necesito usar Supabase CLI desde el principio?

**No.**

Para tener el MVP funcionando rápidamente:

```text
Supabase Dashboard
↓
SQL Editor
↓
Pegar query
↓
Ejecutar
↓
Copiar URL + Publishable Key
↓
.env
```

Es suficiente.

La CLI puede añadirse después.

---

# 15. IMPORTANTE: carpeta music

Hay una diferencia importante entre desarrollo local y una aplicación publicada.

## Local

Durante desarrollo:

```text
project/
└── music/
    ├── song1.flac
    ├── song2.mp3
    └── song3.wav
```

La aplicación puede trabajar con esos archivos.

## Web pública

Una aplicación web desplegada en Vercel **no puede vigilar mágicamente la carpeta `music` de tu PC**.

Si tú agregas:

```text
C:\MiMusica\nueva-cancion.flac
```

después de publicar la web, Vercel no tendrá acceso a ese archivo.

Por eso hay dos conceptos diferentes:

### Biblioteca incluida en el proyecto

```text
public/music/
```

Puede formar parte del deployment.

### Música personal del usuario

Debe agregarse mediante:

- selector de archivos,
- File System Access API cuando aplique,
- almacenamiento remoto,
- Supabase Storage,
- o una versión desktop del reproductor.

**No confundir una carpeta local del proyecto con una carpeta local del ordenador del usuario.**

---

# 16. Para el MVP público

Para mostrar una demo rápidamente, recomiendo:

```text
public/
└── music/
    ├── demo-song-01.mp3
    ├── demo-song-02.flac
    └── ...
```

El scanner podrá leer esos archivos durante el desarrollo/deployment.

Para producción, si queremos que cada usuario pueda agregar su propia música desde cualquier dispositivo, habrá que implementar posteriormente un sistema específico de archivos locales o almacenamiento.

---

# 17. Generar una URL pública rápidamente

La opción rápida para este tipo de aplicación web es Vercel.

urlVercelhttps://vercel.com/

Desde la carpeta raíz del proyecto:

```bash
npm install
npm run build
```

Si el build funciona:

```bash
npm install -g vercel
```

Después:

```bash
vercel login
```

Y:

```bash
vercel
```

Esto genera un deployment de preview y devuelve una URL pública. La CLI de Vercel imprime la URL del deployment al terminar. citeturn1search0turn1search3

---

# 18. Publicar directamente en producción

Si ya está listo:

```bash
vercel --prod
```

Vercel documenta `vercel --prod` como el comando para crear el deployment de producción. citeturn1search0turn1search4

El resultado será una URL similar a:

```text
https://music-player-xxxxx.vercel.app
```

No necesitas comprar dominio.

---

# 19. Configurar variables de Supabase en Vercel

Después del primer deployment:

```text
Vercel
→ Project
→ Settings
→ Environment Variables
```

Agregar las mismas variables que usa el proyecto.

Ejemplo Vite:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Ejemplo Next.js:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Seleccionar:

```text
Production
Preview
Development
```

según lo que se quiera utilizar.

Después volver a desplegar:

```bash
vercel --prod
```

---

# 20. Configurar la URL pública en Supabase Auth

Una vez obtenida la URL:

```text
https://TU-PROYECTO.vercel.app
```

ir a:

```text
Supabase
→ Authentication
→ URL Configuration
```

Configurar:

```text
Site URL
```

con:

```text
https://TU-PROYECTO.vercel.app
```

Y añadir las URLs de redirección necesarias.

Por ejemplo:

```text
https://TU-PROYECTO.vercel.app/**
```

La configuración exacta de redirect deberá corresponder a las rutas reales utilizadas por la aplicación.

---

# 21. Orden exacto para hacerlo rápido

Si quiero tener una primera versión pública cuanto antes:

```bash
# 1. Instalar dependencias
npm install

# 2. Crear .env
# colocar URL + Publishable Key

# 3. Ejecutar localmente
npm run dev

# 4. Comprobar login
# Comprobar reproducción
# Comprobar cola

# 5. Crear build
npm run build

# 6. Instalar Vercel CLI
npm install -g vercel

# 7. Login
vercel login

# 8. Preview
vercel

# 9. Si funciona:
vercel --prod
```

Vercel permite desplegar directamente desde la carpeta del proyecto y genera una URL pública de deployment. citeturn1search0turn1search4

---

# 22. Git + Vercel — opción recomendada después

Una vez que el MVP funcione:

```text
GitHub
   ↓
Vercel
   ↓
Automatic deployments
```

Cada push puede generar deployments automáticamente cuando el repositorio está conectado a Vercel. citeturn1search4turn1search1

Flujo:

```bash
git add .
git commit -m "Initial music player"
git push
```

Vercel se encarga del deployment.

---

# 23. .gitignore obligatorio

No subir:

```text
.env
.env.local
.vercel/
node_modules/
```

Ejemplo:

```gitignore
node_modules/
.env
.env.local
.env.*.local
.vercel/
dist/
build/
```

El `.env.example` sí debe mantenerse:

```env
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
```

---

# 24. Seguridad importante

## Sí puede estar en frontend

```text
SUPABASE_URL
Publishable Key
```

Siempre que las tablas estén protegidas correctamente mediante RLS.

## Nunca poner en frontend

```text
SUPABASE_SECRET_KEY
service_role
contraseñas administrativas
tokens privados
```

Supabase especifica que las claves secretas deben utilizarse únicamente en código que nunca llegue al dispositivo del usuario. citeturn0search8

---

# 25. Checklist antes de publicar

```text
SUPABASE
[ ] Proyecto creado
[ ] Auth Email habilitado
[ ] profiles creada
[ ] playlists creada
[ ] playlist_tracks creada
[ ] RLS habilitado
[ ] Policies creadas
[ ] URL copiada
[ ] Publishable Key copiada

LOCAL
[ ] .env configurado
[ ] npm install
[ ] npm run dev
[ ] Login funciona
[ ] Logout funciona
[ ] Música funciona
[ ] Metadata funciona
[ ] Cola funciona
[ ] Responsive funciona
[ ] npm run build funciona

VERCEL
[ ] vercel login
[ ] vercel
[ ] URL pública obtenida
[ ] Variables de entorno configuradas
[ ] vercel --prod
[ ] URL de producción funcionando

SUPABASE AUTH
[ ] Site URL actualizada
[ ] Redirect URLs configuradas
```

---

# 26. Solución rápida si algo falla

## Error: Supabase no conecta

Comprobar:

```text
URL
Publishable Key
Variables de entorno
```

Después reiniciar:

```bash
npm run dev
```

Las variables de entorno de frontend normalmente se inyectan durante el build/dev server, por lo que cambiar `.env` puede requerir reiniciar el proceso.

---

## Error: 401 / 403 en tablas

Probablemente:

```text
RLS
+
Policy
```

Revisar:

```text
Supabase
→ Authentication
→ usuario actual

Supabase
→ Table Editor
→ tabla
→ RLS / Policies
```

No desactivar RLS como solución permanente.

---

## Error: login funciona localmente pero no en Vercel

Comprobar:

```text
Supabase
→ Authentication
→ URL Configuration
```

y asegurarse de que la URL de Vercel esté configurada.

También comprobar que las variables de entorno estén configuradas para Production en Vercel.

---

## Error: no aparecen canciones en producción

Recordar:

```text
music de tu PC ≠ music del servidor
```

Para una demo web, incluir las canciones dentro de los assets públicos del proyecto.

Para una biblioteca personal real, implementar posteriormente importación local o almacenamiento.

---

# 27. Arquitectura final esperada

```text
                 ┌─────────────────┐
                 │     Vercel      │
                 │  Frontend / Web │
                 └────────┬────────┘
                          │
             ┌────────────┴────────────┐
             │                         │
       ┌─────▼─────┐             ┌─────▼─────┐
       │  Player   │             │ Supabase  │
       │   Local   │             │ Auth + DB  │
       └─────┬─────┘             └───────────┘
             │
       ┌─────▼─────┐
       │   music/  │
       │   Audio   │
       └───────────┘
```

La reproducción local no debe depender innecesariamente de Supabase.

---

# 28. Qué dejar para después

No bloquear el primer deployment por:

- dominio personalizado,
- sincronización completa de biblioteca,
- recomendaciones inteligentes,
- almacenamiento cloud de toda la música,
- estadísticas avanzadas,
- ecualizador avanzado,
- visualizador de espectro,
- sincronización entre dispositivos.

Primero:

```text
Reproducir
+
Metadata
+
Cola
+
UI
+
Login
+
Supabase
+
URL pública
```

Después ampliar.

---

# 29. Referencias oficiales

- urlSupabase — JavaScript Clientturn0search0
- urlSupabase — API Keysturn0search8
- urlSupabase — Local Development / CLIturn0search13
- urlSupabase — Database Migrationsturn0search14
- urlVercel — CLI Deployturn1search0
- urlVercel — Deploy from CLIturn1search1
