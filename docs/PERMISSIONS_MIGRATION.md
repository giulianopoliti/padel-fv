# Guía de Migración: Sistema de Permisos de Torneos

## Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Funciones Disponibles](#funciones-disponibles)
3. [Sistema Legacy (Actual)](#sistema-legacy-actual)
4. [Sistema V2 (Nuevo)](#sistema-v2-nuevo)
5. [Guía de Migración](#guía-de-migración)
6. [Ejemplos de Uso](#ejemplos-de-uso)
7. [Buenas Prácticas](#buenas-prácticas)

---

## Visión General

El sistema de permisos de torneos tiene **dos implementaciones**:

| Sistema | Estado | Descripción |
|---------|--------|-------------|
| **Legacy** | ✅ **En producción** | Sistema binario (hasPermission: true/false) |
| **V2** | 🆕 **Disponible** | Sistema granular con 5 niveles de acceso |

**Recomendación:** Usa **Sistema V2** para nuevos componentes. El sistema legacy se mantiene por compatibilidad.

---

## Funciones Disponibles

### Sistema Legacy (Actual)

```typescript
// 1. Permisos de gestión (ADMIN, CLUB owner, ORGANIZADOR owner)
checkTournamentPermissions(userId: string, tournamentId: string): Promise<PermissionResult>

// 2. Verificar inscripción de jugador
checkUserTournamentInscription(userId: string, tournamentId: string): Promise<UserInscriptionResult>

// 3. Permisos combinados (gestión + inscripción)
checkEnhancedTournamentPermissions(userId: string, tournamentId: string): Promise<EnhancedPermissionResult>

// 4. Verificar permisos de organización
checkOrganizationPermissions(userId: string, tournamentOrganizationId?: string): Promise<boolean>

// 5. Obtener clubs gestionados por el usuario
getUserManagedClubs(userId: string): Promise<{ club_id: string; source: 'owned' | 'organization' }[]>
```

### Sistema V2 (Nuevo)

```typescript
// 1. Chequeo de acceso granular (recomendado)
checkTournamentAccess(userId: string | null, tournamentId: string): Promise<TournamentAccessResult>

// 2. Helper: Verificar permiso específico
hasPermission(access: TournamentAccessResult, permission: TournamentPermission): boolean

// 3. Helper: Verificar cualquier permiso de la lista
hasAnyPermission(access: TournamentAccessResult, permissions: TournamentPermission[]): boolean

// 4. Helper: Verificar todos los permisos de la lista
hasAllPermissions(access: TournamentAccessResult, permissions: TournamentPermission[]): boolean
```

---

## Sistema Legacy (Actual)

### Ubicación

`utils/tournament-permissions.ts` (líneas 95-472)

### Características

- ✅ **En producción** - Usado en 40+ archivos
- ⚠️ **Binario** - Solo retorna `hasPermission: true/false`
- ⚠️ **No distingue** entre jugador activo, eliminado o usuario público
- ✅ **Estable** - Testeado y funcionando correctamente

### Cuándo Usar

- ✅ Mantenimiento de código existente
- ✅ Hotfixes rápidos
- ❌ **NO** para nuevos componentes (usa V2)

### Ejemplo de Uso

```typescript
import { checkTournamentPermissions, checkUserTournamentInscription } from '@/utils/tournament-permissions'

// Verificar permisos de gestión
const { hasPermission, userRole, source } = await checkTournamentPermissions(userId, tournamentId)

if (hasPermission) {
  // Usuario es ADMIN, CLUB owner o ORGANIZADOR owner
  return <AdminPanel />
}

// Verificar inscripción
const { isInscribed, isEliminated } = await checkUserTournamentInscription(userId, tournamentId)

if (isInscribed && !isEliminated) {
  // Jugador activo
  return <PlayerView />
}

// Fallback
return <PublicView />
```

### Limitaciones

1. **No soporta usuarios no autenticados (GUEST)**
   - `userId` es requerido, no acepta `null`
   - Necesitas manejar GUEST manualmente

2. **No distingue entre jugador activo y eliminado**
   - Necesitas verificar `isEliminated` manualmente
   - Lógica dispersa en múltiples lugares

3. **No provee lista de permisos**
   - Solo retorna `hasPermission` binario
   - Dificil implementar UI condicional basada en permisos

---

## Sistema V2 (Nuevo)

### Ubicación

`utils/tournament-permissions.ts` (líneas 474-725)

### Características

- 🆕 **Nuevo** - Disponible para usar
- ✅ **Granular** - 5 niveles de acceso distintos
- ✅ **Soporta GUEST** - `userId` puede ser `null`
- ✅ **Lista de permisos** - Retorna array de permisos específicos
- ✅ **Type-safe** - TypeScript types completos

### 5 Niveles de Acceso

```typescript
type AccessLevel =
  | 'FULL_MANAGEMENT'      // ADMIN, CLUB owner, ORGANIZADOR owner
  | 'PLAYER_ACTIVE'        // Player inscrito activo
  | 'PLAYER_ELIMINATED'    // Player eliminado
  | 'PUBLIC_VIEW'          // ORGANIZADOR no owner, PLAYER no inscrito, GUEST
  | 'NO_ACCESS'            // Error o usuario inválido
```

### Cuándo Usar

- ✅ **Nuevos componentes**
- ✅ **Refactorización de código existente**
- ✅ **Lógica compleja de permisos**
- ✅ **UI condicional basada en permisos**

### Ejemplo Básico

```typescript
import { checkTournamentAccess, hasPermission } from '@/utils/tournament-permissions'

// Usuario autenticado
const access = await checkTournamentAccess(user.id, tournamentId)

// Switch basado en nivel de acceso
switch (access.accessLevel) {
  case 'FULL_MANAGEMENT':
    return <AdminPanel />

  case 'PLAYER_ACTIVE':
    return <PlayerDashboard />

  case 'PLAYER_ELIMINATED':
    return <EliminatedPlayerView />

  case 'PUBLIC_VIEW':
    return <PublicView />

  case 'NO_ACCESS':
    return <ErrorPage />
}
```

### Ejemplo con Permisos

```typescript
import { checkTournamentAccess, hasPermission, hasAnyPermission } from '@/utils/tournament-permissions'

const access = await checkTournamentAccess(user?.id || null, tournamentId)

// Verificar permiso específico
if (hasPermission(access, 'manage_tournament')) {
  return <EditButton />
}

// Verificar cualquiera de varios permisos
if (hasAnyPermission(access, ['view_own_schedule', 'manage_schedules'])) {
  return <SchedulesLink />
}

// Usar lista de permisos directamente
const canUploadImages = access.permissions.includes('upload_images')
```

### Ejemplo con GUEST

```typescript
import { checkTournamentAccess } from '@/utils/tournament-permissions'

// Usuario no autenticado
const access = await checkTournamentAccess(null, tournamentId)

// access.accessLevel === 'PUBLIC_VIEW'
// access.permissions === ['view_public', 'view_public_bracket', ...]
```

---

## Guía de Migración

### Estrategia Recomendada

1. ✅ **Nuevos componentes** → Usa V2 desde el inicio
2. ⚠️ **Código existente** → Migra gradualmente según necesidad
3. ❌ **No refactorices todo** → Alto riesgo, bajo beneficio

### Migración Paso a Paso

#### Paso 1: Identificar uso de funciones legacy

```bash
# Buscar usos en el codebase
grep -r "checkTournamentPermissions" app/
grep -r "checkEnhancedTournamentPermissions" app/
```

#### Paso 2: Evaluar si migrar

**Migra si:**
- ✅ Necesitas distinguir entre jugador activo/eliminado
- ✅ Necesitas soportar usuarios no autenticados (GUEST)
- ✅ Necesitas lógica compleja de permisos
- ✅ Estás refactorizando el componente por otras razones

**NO migres si:**
- ❌ El componente funciona bien y no tiene bugs
- ❌ Es código crítico en producción sin tests
- ❌ No hay tiempo para testing adecuado

#### Paso 3: Reemplazar función

**ANTES (Legacy):**

```typescript
import { checkEnhancedTournamentPermissions } from '@/utils/tournament-permissions'

const { hasPermission, inscriptionResult } = await checkEnhancedTournamentPermissions(userId, tournamentId)

if (hasPermission) {
  return <AdminPanel />
}

if (inscriptionResult?.isInscribed && !inscriptionResult.isEliminated) {
  return <PlayerView />
}

return <PublicView />
```

**DESPUÉS (V2):**

```typescript
import { checkTournamentAccess } from '@/utils/tournament-permissions'

const access = await checkTournamentAccess(userId, tournamentId)

switch (access.accessLevel) {
  case 'FULL_MANAGEMENT':
    return <AdminPanel />

  case 'PLAYER_ACTIVE':
    return <PlayerView />

  case 'PLAYER_ELIMINATED':
    return <EliminatedPlayerView />

  case 'PUBLIC_VIEW':
    return <PublicView />

  default:
    return <ErrorPage />
}
```

#### Paso 4: Testear

```bash
# Ejecutar tests
npm test -- path/to/your/component.test.ts

# Verificar en desarrollo
npm run dev
```

#### Paso 5: Deploy gradual

1. Migra 1-2 componentes primero
2. Monitorea en producción
3. Si funciona bien, continúa con más componentes

---

## Ejemplos de Uso

### Ejemplo 1: Server Component con Usuario Autenticado

```typescript
// app/(main)/tournaments/[id]/page.tsx
import { createClient } from '@/utils/supabase/server'
import { checkTournamentAccess } from '@/utils/tournament-permissions'

export default async function TournamentPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const access = await checkTournamentAccess(user?.id || null, params.id)

  return (
    <div>
      <h1>Tournament {params.id}</h1>

      {/* Mostrar panel de administración solo si tiene permisos */}
      {access.accessLevel === 'FULL_MANAGEMENT' && (
        <AdminControls />
      )}

      {/* Mostrar botón de editar si tiene permiso */}
      {access.permissions.includes('manage_tournament') && (
        <EditButton />
      )}

      {/* Mostrar vista según nivel de acceso */}
      {access.accessLevel === 'PLAYER_ACTIVE' && (
        <PlayerDashboard coupleId={access.metadata.coupleId} />
      )}

      {/* Siempre mostrar info pública */}
      <PublicTournamentInfo />
    </div>
  )
}
```

### Ejemplo 2: Layout con Routing Condicional

```typescript
// app/(main)/tournaments/[id]/schedules/layout.tsx
import { createClient } from '@/utils/supabase/server'
import { checkTournamentAccess } from '@/utils/tournament-permissions'
import { redirect } from 'next/navigation'

export default async function SchedulesLayout({
  children,
  organizer,
  player,
  params
}: {
  children: React.ReactNode
  organizer: React.ReactNode
  player: React.ReactNode
  params: { id: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Usuarios no autenticados no pueden ver horarios
  if (!user) {
    redirect(`/tournaments/${params.id}`)
  }

  const access = await checkTournamentAccess(user.id, params.id)

  // Routing basado en nivel de acceso
  switch (access.accessLevel) {
    case 'FULL_MANAGEMENT':
      return organizer // Vista de organizador con todas las fechas

    case 'PLAYER_ACTIVE':
      return player // Vista de jugador con sus partidos

    case 'PLAYER_ELIMINATED':
      return <EliminatedPlayerSchedulesView tournamentId={params.id} />

    case 'PUBLIC_VIEW':
      // Usuarios sin permisos especiales no pueden ver horarios
      redirect(`/tournaments/${params.id}`)

    default:
      redirect(`/tournaments/${params.id}`)
  }
}
```

### Ejemplo 3: Client Component con useEffect

```typescript
'use client'

import { useEffect, useState } from 'react'
import { checkTournamentAccess, type TournamentAccessResult } from '@/utils/tournament-permissions'
import { useUser } from '@/contexts/user-context'

export function TournamentActions({ tournamentId }: { tournamentId: string }) {
  const { user } = useUser()
  const [access, setAccess] = useState<TournamentAccessResult | null>(null)

  useEffect(() => {
    async function loadAccess() {
      const result = await checkTournamentAccess(user?.id || null, tournamentId)
      setAccess(result)
    }
    loadAccess()
  }, [user, tournamentId])

  if (!access) return <LoadingSpinner />

  return (
    <div>
      {/* Botón de gestión */}
      {access.permissions.includes('manage_tournament') && (
        <Button onClick={handleManage}>Gestionar Torneo</Button>
      )}

      {/* Botón de inscripción */}
      {access.permissions.includes('register_couple') && (
        <Button onClick={handleRegister}>Inscribir Pareja</Button>
      )}

      {/* Botón de ver horarios */}
      {access.permissions.includes('view_own_schedule') && (
        <Button onClick={handleViewSchedules}>Mis Horarios</Button>
      )}
    </div>
  )
}
```

### Ejemplo 4: API Route con Validación

```typescript
// app/api/tournaments/[id]/update/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { checkTournamentAccess, hasPermission } from '@/utils/tournament-permissions'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verificar permisos con V2
  const access = await checkTournamentAccess(user.id, params.id)

  // Verificar permiso específico
  if (!hasPermission(access, 'manage_tournament')) {
    return NextResponse.json(
      { error: 'No tienes permisos para gestionar este torneo' },
      { status: 403 }
    )
  }

  // Usuario tiene permisos, proceder con la actualización
  const body = await request.json()
  // ... lógica de actualización ...

  return NextResponse.json({ success: true })
}
```

---

## Buenas Prácticas

### 1. Usa V2 para Nuevos Componentes

```typescript
// ✅ CORRECTO
import { checkTournamentAccess } from '@/utils/tournament-permissions'

const access = await checkTournamentAccess(userId, tournamentId)

// ❌ INCORRECTO (legacy en código nuevo)
import { checkEnhancedTournamentPermissions } from '@/utils/tournament-permissions'

const { hasPermission } = await checkEnhancedTournamentPermissions(userId, tournamentId)
```

### 2. Maneja Usuarios No Autenticados

```typescript
// ✅ CORRECTO
const access = await checkTournamentAccess(user?.id || null, tournamentId)

// ❌ INCORRECTO (crash si user es null)
const access = await checkTournamentAccess(user.id, tournamentId)
```

### 3. Usa Switch para Niveles de Acceso

```typescript
// ✅ CORRECTO - Exhaustivo y type-safe
switch (access.accessLevel) {
  case 'FULL_MANAGEMENT':
    return <AdminView />
  case 'PLAYER_ACTIVE':
    return <PlayerView />
  case 'PLAYER_ELIMINATED':
    return <EliminatedView />
  case 'PUBLIC_VIEW':
    return <PublicView />
  case 'NO_ACCESS':
    return <ErrorView />
}

// ❌ INCORRECTO - Puede omitir casos
if (access.accessLevel === 'FULL_MANAGEMENT') return <AdminView />
if (access.accessLevel === 'PLAYER_ACTIVE') return <PlayerView />
// ¿Qué pasa con PLAYER_ELIMINATED?
```

### 4. Usa Helper Functions

```typescript
// ✅ CORRECTO - Legible y mantenible
import { hasPermission, hasAnyPermission } from '@/utils/tournament-permissions'

if (hasPermission(access, 'manage_tournament')) {
  // ...
}

if (hasAnyPermission(access, ['view_own_schedule', 'manage_schedules'])) {
  // ...
}

// ❌ INCORRECTO - Verboso y propenso a errores
if (access.permissions.includes('manage_tournament')) {
  // ...
}

if (
  access.permissions.includes('view_own_schedule') ||
  access.permissions.includes('manage_schedules')
) {
  // ...
}
```

### 5. Cache en Client Components

```typescript
// ✅ CORRECTO - Cache con SWR o React Query
import useSWR from 'swr'

const fetcher = async (key: [string, string]) => {
  const [_, userId, tournamentId] = key
  return checkTournamentAccess(userId, tournamentId)
}

export function useTournamentAccess(userId: string | null, tournamentId: string) {
  return useSWR(['tournament-access', userId, tournamentId], fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  })
}

// Uso
const { data: access, isLoading } = useTournamentAccess(user?.id || null, tournamentId)
```

### 6. Tests

```typescript
// ✅ CORRECTO - Test de cada nivel de acceso
describe('TournamentPage', () => {
  it('shows admin panel for FULL_MANAGEMENT', async () => {
    mockCheckTournamentAccess.mockResolvedValue({
      accessLevel: 'FULL_MANAGEMENT',
      permissions: ['manage_tournament'],
      metadata: {}
    })

    render(<TournamentPage tournamentId="123" />)
    expect(screen.getByText('Admin Panel')).toBeInTheDocument()
  })

  it('shows player view for PLAYER_ACTIVE', async () => {
    mockCheckTournamentAccess.mockResolvedValue({
      accessLevel: 'PLAYER_ACTIVE',
      permissions: ['view_own_schedule'],
      metadata: { isInscribed: true }
    })

    render(<TournamentPage tournamentId="123" />)
    expect(screen.getByText('My Matches')).toBeInTheDocument()
  })

  // ... tests para otros niveles ...
})
```

---

## Resumen

### Sistema Legacy

- ✅ Usa para mantener código existente
- ❌ NO uses para nuevos componentes
- ⚠️ Limitaciones: no soporta GUEST, no granular

### Sistema V2

- ✅ Usa para nuevos componentes
- ✅ Migra gradualmente código existente
- ✅ Soporta GUEST, granular, type-safe

### Migración

1. Nuevos componentes → V2 desde el inicio
2. Código existente → Migra gradualmente
3. Testing → Valida cada migración
4. Deploy → Gradual y monitoreado

---

**Última actualización:** 2025-10-27
**Mantenedor:** Sistema de Torneos de Pádel
