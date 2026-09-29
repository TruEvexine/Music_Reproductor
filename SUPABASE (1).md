# Supabase — Plan de Integración

## Objetivo

Este documento define la integración de Supabase para el reproductor de música.

Supabase se utilizará principalmente para:

- Autenticación.
- Identidad del usuario.
- Persistencia de datos asociados a la cuenta.
- Playlists sincronizadas, si se implementan.
- Preferencias sincronizadas, si se implementan.

La reproducción de archivos locales y el escaneo de `music/` deberán funcionar como una capa independiente.

---

# 1. Información necesaria

La aplicación necesitará configurar variables de entorno equivalentes a:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

No colocar secretos administrativos en el cliente.

No utilizar:

```text
SUPABASE_SERVICE_ROLE_KEY
```

en una aplicación cliente.

---

# 2. Supabase Auth

Utilizar Supabase Auth para:

- Registro.
- Inicio de sesión.
- Cierre de sesión.
- Recuperación de sesión.
- Usuario autenticado.

No implementar almacenamiento propio de contraseñas.

## Flujo

```text
Usuario
 ↓
Login/Register
 ↓
Supabase Auth
 ↓
Sesión
 ↓
Aplicación
```

---

# 3. Perfil de usuario

Crear una tabla equivalente a:

```sql
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text,
    avatar_url text,
    created_at timestamptz default now()
);
```

El `id` deberá corresponder al usuario de `auth.users`.

---

# 4. Row Level Security

Activar RLS:

```sql
alter table public.profiles enable row level security;
```

Un usuario solamente deberá poder consultar/modificar su propio perfil.

Ejemplo conceptual:

```sql
create policy "Users can view own profile"
on public.profiles
for select
using (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles
for update
using (auth.uid() = id);
```

Las policies finales deberán revisarse según la arquitectura real.

---

# 5. Playlists

Si las playlists deben sincronizarse entre dispositivos:

```sql
create table public.playlists (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    created_at timestamptz default now()
);
```

RLS:

```sql
alter table public.playlists enable row level security;
```

Un usuario únicamente podrá acceder a sus playlists.

---

# 6. Canciones de playlists

Como los archivos de música son locales, no asumir que Supabase almacena el archivo de audio.

La tabla puede guardar un identificador lógico:

```sql
create table public.playlist_tracks (
    id uuid primary key default gen_random_uuid(),
    playlist_id uuid not null references public.playlists(id) on delete cascade,
    track_identifier text not null,
    position integer not null default 0,
    created_at timestamptz default now()
);
```

`track_identifier` deberá corresponder a una estrategia estable definida por la aplicación.

Ejemplos:

```text
hash del archivo
```

o

```text
identificador de metadata + información del archivo
```

No depender únicamente de una ruta absoluta del ordenador si se pretende sincronizar entre dispositivos.

---

# 7. Archivos locales vs datos remotos

Diferenciar siempre:

## Local

```text
/music/Artist/Album/song.flac
```

Contiene:

- Audio.
- Metadata.
- Portada embebida.

## Supabase

Contiene:

- Usuario.
- Perfil.
- Playlists.
- Orden de playlists.
- Preferencias sincronizables.

No subir automáticamente toda la biblioteca local a Supabase.

---

# 8. Variables de entorno

Crear:

```text
.env
```

pero no incluirlo en Git.

Crear:

```text
.env.example
```

con:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

El `.env.example` sí puede formar parte del repositorio.

---

# 9. Conexión

Crear un servicio central:

```text
SupabaseService
```

Responsabilidades:

- Inicializar cliente.
- Obtener sesión.
- Login.
- Registro.
- Logout.
- Obtener usuario actual.
- Operaciones de perfiles.
- Operaciones de playlists.

No repartir llamadas a Supabase por toda la UI.

---

# 10. Manejo de sesión

Al iniciar:

```text
Inicializar Supabase
        ↓
Comprobar sesión
        ↓
¿Existe?
 ┌──────┴──────┐
Sí             No
↓               ↓
Cargar usuario  Usuario invitado
```

La UI deberá reaccionar a cambios de sesión.

---

# 11. Fallos de conexión

La aplicación no deberá romperse si Supabase está temporalmente inaccesible.

La reproducción local deberá seguir funcionando siempre que no dependa de una función remota.

Ejemplo:

```text
Supabase offline
      ↓
Login/Sync puede fallar
      ↓
Reproductor local sigue funcionando
```

Mostrar errores de red de forma clara.

---

# 12. Seguridad

Nunca:

- Guardar contraseñas manualmente.
- Exponer service role key.
- Desactivar RLS solamente para facilitar el desarrollo.
- Confiar en `user_id` enviado desde la interfaz sin políticas.
- Guardar secretos en el código fuente.

Siempre:

- Usar Auth.
- Usar RLS.
- Mantener claves en variables de entorno.
- Restringir acceso por `auth.uid()`.

---

# 13. Si la IA tiene acceso directo a Supabase

Si la herramienta de desarrollo dispone de una conexión autorizada a Supabase:

1. Comprobar proyecto.
2. Comprobar tablas existentes.
3. Comprobar Auth.
4. Comprobar RLS.
5. No sobrescribir estructuras existentes sin verificar.
6. Aplicar migraciones controladas.
7. Probar login.
8. Probar lectura/escritura.
9. Documentar cualquier cambio realizado.

---

# 14. Si la IA NO tiene acceso a Supabase

Debe generar:

```text
SUPABASE_SETUP.sql
```

con las tablas, índices, RLS y policies necesarias.

También deberá proporcionar los pasos:

```text
1. Crear proyecto
2. Configurar Auth
3. Ejecutar SQL
4. Copiar URL
5. Copiar anon/public key
6. Configurar .env
7. Iniciar aplicación
8. Probar registro/login
```

No inventar valores de configuración.

---

# 15. Criterios de aceptación

- [ ] Supabase conecta correctamente.
- [ ] Registro funciona.
- [ ] Login funciona.
- [ ] Logout funciona.
- [ ] La sesión se conserva.
- [ ] Perfil asociado al usuario.
- [ ] RLS activado.
- [ ] Usuario A no puede acceder a datos privados del usuario B.
- [ ] Playlist puede guardarse si se implementa.
- [ ] La aplicación continúa reproduciendo música local cuando Supabase no está disponible.
- [ ] No existen secretos administrativos en el cliente.
