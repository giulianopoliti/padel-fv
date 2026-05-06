# padel-base

Base single-tenant para clonar y convertir en forks de organizaciones de padel.

## Objetivo

Este repo no representa una red publica de organizadores. Cada instalacion se configura para una sola organizacion activa y se personaliza con branding, dominio y datos propios.

## Flujo recomendado para un nuevo fork

1. Duplicar este repo.
2. Crear un proyecto Supabase nuevo para el cliente.
3. Correr migraciones y preparar buckets de storage.
4. Configurar branding y tenant en `config/tenant.ts`.
5. Actualizar variables de entorno y dominio.
6. Migrar los datos de la organizacion del cliente.
7. Deployar en Vercel.

## Variables importantes

Copiar `.env.example` a `.env.local` y completar:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_TENANT_ORGANIZATION_SLUG`

## Setup de Supabase para un fork nuevo

### 1. Crear el proyecto

Crear un proyecto Supabase nuevo para el cliente desde el dashboard.

### 2. Completar variables

Usar las credenciales del proyecto nuevo en `.env.local`.

### 3. Vincular el repo al proyecto nuevo

Comandos sugeridos:

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
```

### 4. Ejecutar migraciones

```bash
supabase db push
```

### 5. Deployar funciones edge

```bash
supabase functions deploy get-club-tournaments
supabase functions deploy get-organization-tournaments
supabase functions deploy get-player-inscribed-tournaments
supabase functions deploy get-player-next-match
supabase functions deploy get-player-upcoming-tournaments
supabase functions deploy search-players-organization
supabase functions deploy search-ranking-players
supabase functions deploy search-tournament-players
```

### 6. Configurar auth

En Supabase Auth configurar:

- `Site URL`
- `Redirect URLs`
- proveedor Google si el fork lo usa
- recovery/reset password para el dominio del cliente

### 7. Migrar datos del cliente

Migrar solo la organizacion objetivo y sus relaciones:

- organizacion
- members
- clubs
- players
- tournaments
- inscripciones, matches y tablas relacionadas
- assets de storage

## Convenciones del base

- Registro publico: solo `PLAYER`
- Organizadores: alta manual
- Login: unificado para jugadores y organizadores
- Home: logo del tenant, proximos torneos, clubes y ranking
- Datos publicos: filtrados por la organizacion configurada

## Notas

- La base de datos mantiene el esquema multi-organizacion para no romper permisos ni paneles existentes.
- La experiencia del producto se comporta como single-tenant.
- `supabase/.temp` y `supabase/.branches` son estado local del CLI y no deben reutilizarse entre forks.
