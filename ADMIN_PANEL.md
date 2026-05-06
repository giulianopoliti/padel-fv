# 🛡️ Panel de Administración - Documentación Completa

## Índice
1. [Introducción](#introducción)
2. [Acceso y Seguridad](#acceso-y-seguridad)
3. [Estructura del Panel](#estructura-del-panel)
4. [Funcionalidades por Módulo](#funcionalidades-por-módulo)
5. [Arquitectura Técnica](#arquitectura-técnica)
6. [Seguridad Implementada](#seguridad-implementada)
7. [Mejoras Futuras](#mejoras-futuras)

---

## Introducción

El Panel de Administración es una interfaz completa para gestionar todos los aspectos del sistema de torneos de pádel sin necesidad de acceder directamente a la base de datos o escribir SQL.

### Características Principales
- ✅ **Gestión completa de datos**: CRUD completo para usuarios, jugadores, clubes, organizaciones y torneos
- ✅ **Acciones especiales para torneos**: Revertir estados, cancelar torneos
- ✅ **Seguridad robusta**: Rate limiting, autenticación, verificación de roles
- ✅ **Interfaz intuitiva**: Diseño limpio con tablas, filtros y modales
- ✅ **Bypass de RLS**: Usa `service_role_key` para operaciones sin restricciones

---

## Acceso y Seguridad

### Credenciales de Acceso

**URL de Login:** `/admin-login`

**Credenciales:**
- **Email:** `admin@padel-cpa.com`
- **Password:** `Admin123!Padel2024`
- **Rol:** `ADMIN` (automático)

⚠️ **IMPORTANTE:** Estas credenciales deben cambiarse en producción.

### Niveles de Seguridad Implementados

#### 1. **Rate Limiting** ✅
- **Máximo de intentos:** 5 intentos fallidos
- **Ventana de tiempo:** 15 minutos
- **Bloqueo temporal:** 30 minutos después de 5 intentos fallidos
- **Tracking por:** Dirección IP del cliente
- **Almacenamiento:** In-memory (Map) - se reinicia con el servidor

**Mensajes al usuario:**
- `"Credenciales incorrectas. Te quedan X intentos."`
- `"Tu IP está bloqueada por 30 minutos."`

**Implementación:** [`lib/rate-limit.ts`](lib/rate-limit.ts)

#### 2. **Autenticación y Autorización** ✅
- **Middleware de Next.js:** Verifica autenticación y rol en cada request
- **Server Actions:** Todas las acciones llaman `verifyAdmin()` al inicio
- **Admin Layout:** Server component que valida antes de renderizar
- **Session Management:** Sesiones de Supabase Auth

**Archivos clave:**
- [`utils/supabase/middleware.ts`](utils/supabase/middleware.ts) - Middleware de rutas
- [`lib/supabase-admin.ts`](lib/supabase-admin.ts) - Cliente con service_role_key
- [`app/(main)/admin/layout.tsx`](app/(main)/admin/layout.tsx) - Layout protegido

#### 3. **Bypass de RLS con Service Role Key** ✅
- Todas las operaciones de admin usan `supabaseAdmin`
- Service Role Key configurada en `.env`
- **Variable:** `SUPABASE_SERVICE_ROLE_KEY`
- Permite operaciones sin restricciones de Row Level Security

---

## Estructura del Panel

### Rutas Disponibles

```
/admin-login              → Login exclusivo de admin (tema rojo)
/admin                    → Dashboard principal
/admin/users              → Gestión de usuarios (solo lectura)
/admin/players            → Gestión de jugadores (CRUD + vinculación)
/admin/clubs              → Gestión de clubes (CRUD + toggle activo)
/admin/organizations      → Gestión de organizaciones (CRUD + miembros + clubes)
/admin/tournaments        → Gestión de torneos (CRUD + acciones especiales)
/admin/matches            → Gestión de partidos (pendiente)
```

### Navegación

**AdminSidebar** ([`components/admin/AdminSidebar.tsx`](components/admin/AdminSidebar.tsx)):
- Dashboard
- Usuarios
- Jugadores
- Clubes
- Organizadores
- Torneos
- Partidos
- Logout

**Tema visual:** Rojo (para distinguir del panel principal)

---

## Funcionalidades por Módulo

### 1. **Dashboard** (`/admin`)

**Vista general con estadísticas:**
- Total de usuarios
- Total de jugadores
- Total de clubes
- Total de organizaciones
- Total de torneos
- Total de partidos

**Links rápidos** a cada sección.

**Archivo:** [`app/(main)/admin/page.tsx`](app/(main)/admin/page.tsx)

---

### 2. **Usuarios** (`/admin/users`)

**Funcionalidad:** Solo lectura (view-only)

**Datos mostrados:**
- Email
- Rol (PLAYER, COACH, CLUB, ADMIN)
- Estado activo
- Fecha de creación

**Propósito:** Ver todos los usuarios registrados en el sistema.

**Archivos:**
- [`app/(main)/admin/users/page.tsx`](app/(main)/admin/users/page.tsx)

---

### 3. **Jugadores** (`/admin/players`)

**Funcionalidad:** CRUD completo + vinculación de usuarios

#### Tabla Principal
- Nombre completo
- DNI
- Teléfono
- Puntaje
- Categoría
- Estado (Activo/Inactivo/Suspendido)
- Usuario vinculado (email)
- Club

#### Acciones Disponibles

**Botón Editar (✏️):**
Abre modal con formulario completo:
- **Datos Básicos:** Nombre, apellido, DNI, teléfono, fecha de nacimiento, género, dirección
- **Datos Deportivos:** Puntaje, categoría, mano preferida, lado preferido, pala
- **Redes y Estado:** Instagram, estado (activo/inactivo/suspendido)
- **Descripción:** Texto libre

**Botón Vincular (🔗):**
Abre modal de vinculación de usuario:
- **Usuario actual:** Muestra el usuario vinculado actual con botón "Desvincular"
- **Búsqueda de usuarios:** Input con debouncing para buscar por email
- **Resultados:** Lista de usuarios con indicación si ya están vinculados a otro jugador
- **Acción:** Botón "Vincular" para cada usuario disponible

#### Validaciones
- ✅ DNI único (no puede haber dos jugadores con el mismo DNI)
- ✅ user_id único (un usuario solo puede estar vinculado a un jugador)
- ✅ Strings vacíos se convierten a `null`
- ✅ Solo se envían campos que cambiaron

**Archivos:**
- [`app/(main)/admin/players/page.tsx`](app/(main)/admin/players/page.tsx)
- [`app/(main)/admin/players/players-client.tsx`](app/(main)/admin/players/players-client.tsx)
- [`components/admin/EditPlayerForm.tsx`](components/admin/EditPlayerForm.tsx)
- [`components/admin/PlayerUserLinkComponent.tsx`](components/admin/PlayerUserLinkComponent.tsx)
- [`app/api/admin/players/actions.ts`](app/api/admin/players/actions.ts)

**Server Actions:**
- `updatePlayer(id, data)` - Actualizar jugador
- `linkPlayerToUser(playerId, userId)` - Vincular usuario
- `unlinkPlayer(playerId)` - Desvincular usuario
- `searchUsers(query)` - Buscar usuarios por email
- `getCategories()` - Obtener categorías para dropdown

---

### 4. **Clubes** (`/admin/clubs`)

**Funcionalidad:** CRUD completo + toggle activo/inactivo

#### Tabla Principal
- Nombre
- Email
- Teléfono
- Dirección
- Canchas
- Estado (Activo/Inactivo)
- Usuario vinculado (email)

#### Acciones Disponibles

**Botón Editar (✏️):**
Abre modal con formulario:
- **Datos Básicos:** Nombre, email, teléfonos (1 y 2), dirección
- **Instalaciones:** Número de canchas, horario de apertura, horario de cierre
- **Redes y Web:** Instagram, sitio web
- **Descripción:** Texto libre

**Botón Power (⚡):**
- Toggle entre Activo/Inactivo
- Confirmación antes de cambiar
- Los clubes inactivos no pueden acceder al sistema

#### Validaciones
- ✅ Strings vacíos se convierten a `null`
- ✅ Solo se envían campos que cambiaron

**Archivos:**
- [`app/(main)/admin/clubs/page.tsx`](app/(main)/admin/clubs/page.tsx)
- [`app/(main)/admin/clubs/clubs-client.tsx`](app/(main)/admin/clubs/clubs-client.tsx)
- [`components/admin/EditClubForm.tsx`](components/admin/EditClubForm.tsx)
- [`app/api/admin/clubs/actions.ts`](app/api/admin/clubs/actions.ts)

**Server Actions:**
- `updateClub(id, data)` - Actualizar club
- `toggleClubActive(id)` - Toggle activo/inactivo

---

### 5. **Organizadores** (`/admin/organizations`)

**Funcionalidad:** CRUD completo + gestión de miembros + visualización de clubes

#### Tabla Principal
- Nombre
- Responsable (nombre y apellido)
- Email
- Teléfono
- Estado (Activo/Inactivo)
- **Expandible:** Click para ver usuarios y clubes

#### Sección Expandible (Tabs)

**Tab 1: Usuarios (X)**
Muestra los miembros de la organización:
- user_id
- Email (JOIN con tabla users)
- Rol del usuario (PLAYER, COACH, CLUB)
- Rol en organización (owner, admin, member)
- Estado (Activo/Inactivo)

**Acciones en usuarios:**
- **Dropdown de rol:** Cambiar entre owner/admin/member
- **Botón Activar/Desactivar:** Toggle is_active

**Tab 2: Clubes (X)**
Muestra los clubes asociados a la organización:
- Nombre del club
- Email
- Estado (Activo/Inactivo)
- Fecha de asociación

**Solo lectura** - no se puede modificar desde aquí.

#### Acciones Principales

**Botón Editar (✏️):**
Abre modal con formulario:
- **Datos de la Organización:** Nombre, email, teléfono
- **Datos del Responsable:** Nombre, apellido, DNI
- **Descripción:** Texto libre

**Botón Power (⚡):**
- Toggle entre Activo/Inactivo
- Confirmación antes de cambiar

#### Lazy Loading
- Los miembros se cargan al expandir por primera vez
- Los clubes se cargan al cambiar a la tab "Clubes"
- Evita cargar datos innecesarios

**Archivos:**
- [`app/(main)/admin/organizations/page.tsx`](app/(main)/admin/organizations/page.tsx)
- [`app/(main)/admin/organizations/organizations-client.tsx`](app/(main)/admin/organizations/organizations-client.tsx)
- [`components/admin/EditOrganizationForm.tsx`](components/admin/EditOrganizationForm.tsx)
- [`components/admin/OrganizationMembersTable.tsx`](components/admin/OrganizationMembersTable.tsx)
- [`components/admin/OrganizationClubsTable.tsx`](components/admin/OrganizationClubsTable.tsx)
- [`app/api/admin/organizations/actions.ts`](app/api/admin/organizations/actions.ts)

**Server Actions:**
- `getOrganizationsWithMembers()` - Fetch organizaciones
- `getOrganizationMembers(orgId)` - Fetch miembros con JOIN a users
- `getOrganizationClubs(orgId)` - Fetch clubes asociados
- `updateOrganization(id, data)` - Actualizar organización
- `toggleOrganizationActive(id)` - Toggle activo/inactivo
- `toggleMemberActive(memberId, orgId)` - Toggle miembro activo
- `updateMemberRole(memberId, role)` - Cambiar rol de miembro

---

### 6. **Torneos** (`/admin/tournaments`)

**Funcionalidad:** CRUD completo + acciones especiales de administración

#### Tabla Principal
- Nombre
- Categoría
- Estado (NOT_STARTED, ZONE_PHASE, BRACKET_PHASE, FINISHED, CANCELED)
- Tipo (Americano 2, Americano 4, Knockout)
- Club/Organización
- Fechas (inicio)
- Max participantes
- Precio

**Color coding por estado:**
- 🟤 NOT_STARTED → Gris
- 🔵 ZONE_PHASE → Azul
- 🟡 BRACKET_PHASE → Amarillo
- 🟢 FINISHED → Verde
- 🔴 CANCELED → Rojo

#### Filtros
- **Búsqueda:** Por nombre del torneo
- **Estado:** Dropdown (Todos, No Iniciado, Fase de Zonas, Fase de Bracket, Finalizado, Cancelado)

#### Acciones Disponibles

**Botón Editar (✏️):**
Abre modal con formulario completo:
- **Datos Básicos:** Nombre, descripción, precio, premio
- **Configuración:** Max participantes, categoría, género, tipo
- **Fechas:** Fecha de inicio, fecha de finalización
- **Estado:** Dropdown para cambiar el status
  - ⚠️ Advertencia: "Cambiar el estado manualmente puede causar inconsistencias. Usa las acciones especiales cuando sea posible."

**Botón Acciones (⚙️):**
Abre menú desplegable con acciones según el estado actual:

##### Si status = ZONE_PHASE:
**🔄 Volver a No Iniciado** (Naranja)
- Elimina: Todas las zonas, zone_couples, zone_positions, partidos de zona
- Cambia status a: NOT_STARTED
- ⚠️ Confirmación requerida con advertencia de irreversibilidad

##### Si status = BRACKET_PHASE:
**🔄 Volver a Fase de Zonas** (Amarillo)
- Elimina: Seeds, match_hierarchy, bracket_operations_log, match_results_history, partidos de bracket
- Mantiene: Datos de zona intactos
- Cambia status a: ZONE_PHASE
- ⚠️ Confirmación requerida con advertencia de irreversibilidad

##### Si status != FINISHED y != CANCELED:
**🚫 Cancelar Torneo** (Rojo)
- Cambia status a: CANCELED
- No elimina datos, solo marca como cancelado
- ⚠️ Confirmación requerida

#### Validaciones
- ✅ Strings vacíos se convierten a `null`
- ✅ Solo se envían campos que cambiaron
- ✅ Validación de estado antes de ejecutar acciones

**Archivos:**
- [`app/(main)/admin/tournaments/page.tsx`](app/(main)/admin/tournaments/page.tsx)
- [`app/(main)/admin/tournaments/tournaments-client.tsx`](app/(main)/admin/tournaments/tournaments-client.tsx)
- [`components/admin/EditTournamentForm.tsx`](components/admin/EditTournamentForm.tsx)
- [`components/admin/TournamentActionsMenu.tsx`](components/admin/TournamentActionsMenu.tsx)
- [`app/api/admin/tournaments/actions.ts`](app/api/admin/tournaments/actions.ts)

**Server Actions:**
- `updateTournament(id, data)` - Actualizar torneo
- `cancelTournamentAction(id)` - Cancelar torneo
- `backToNotStartedAction(id)` - Volver a NOT_STARTED (elimina zonas)
- `backToZonesAction(id)` - Volver a ZONE_PHASE (elimina bracket)

**⚠️ IMPORTANTE:** Las acciones de revertir estados usan `supabaseAdmin` para bypassear RLS y eliminar todos los datos relacionados.

---

## Arquitectura Técnica

### Stack Tecnológico
- **Frontend:** Next.js 15 App Router, React 19, TypeScript
- **Backend:** Next.js Server Actions
- **Database:** Supabase PostgreSQL
- **Auth:** Supabase Auth
- **UI:** Tailwind CSS, Radix UI, shadcn/ui
- **State:** React useState, useEffect (sin optimistic updates)

### Patrón de Arquitectura

#### Server Components (páginas)
```typescript
// app/(main)/admin/[module]/page.tsx
async function getData() {
  const { data } = await supabaseAdmin.from('table').select('*')
  return data
}

export default async function Page() {
  const data = await getData()
  return <ClientComponent data={data} />
}
```

#### Client Components (interactividad)
```typescript
// app/(main)/admin/[module]/client.tsx
"use client"

export function ClientComponent({ data }) {
  const [editing, setEditing] = useState(null)

  const handleSave = async () => {
    await serverAction(data)
    window.location.reload() // Simple reload, no optimistic updates
  }

  return <Table data={data} onEdit={handleEdit} />
}
```

#### Server Actions (operaciones)
```typescript
// app/api/admin/[module]/actions.ts
"use server"

export async function updateEntity(id, data) {
  await verifyAdmin() // ✅ Verificar rol ADMIN

  const { error } = await supabaseAdmin // ✅ Usar service_role_key
    .from('table')
    .update(data)
    .eq('id', id)

  if (error) throw error

  revalidatePath('/admin/[module]') // ✅ Invalidar cache
  return { success: true }
}
```

### Componentes Reutilizables

**AdminEditModal** ([`components/admin/AdminEditModal.tsx`](components/admin/AdminEditModal.tsx)):
- Modal genérico para edición
- Props: isOpen, onClose, onSave, title, children
- Footer con botones Cancel/Save
- Loading state

**ConfirmDialog** ([`components/admin/ConfirmDialog.tsx`](components/admin/ConfirmDialog.tsx)):
- Diálogo de confirmación
- Props: isOpen, onClose, onConfirm, title, description
- Usado para acciones destructivas

**AdminSidebar** ([`components/admin/AdminSidebar.tsx`](components/admin/AdminSidebar.tsx)):
- Navegación lateral
- Links a todas las secciones
- Botón de logout

### Flujo de Datos

1. **Request** → Middleware verifica autenticación y rol ADMIN
2. **Server Page** → Fetch de datos usando `supabaseAdmin`
3. **Client Component** → Renderiza tabla/formularios
4. **User Action** → Click en botón editar/eliminar
5. **Server Action** → Ejecuta operación con `supabaseAdmin`
6. **Revalidate** → Invalida cache de Next.js
7. **Reload** → `window.location.reload()` para refrescar datos

---

## Seguridad Implementada

### 1. **Rate Limiting** ✅
**Ubicación:** [`lib/rate-limit.ts`](lib/rate-limit.ts)

**Funciones:**
- `isBlocked(ip)` - Verifica si IP está bloqueada
- `recordFailedAttempt(ip)` - Registra intento fallido
- `clearRateLimit(ip)` - Limpia rate limit (login exitoso)
- `getClientIP(headers)` - Obtiene IP del cliente
- `formatTimeRemaining(seconds)` - Formatea tiempo restante

**Configuración:**
```typescript
const MAX_ATTEMPTS = 5           // Máximo de intentos
const WINDOW_MS = 15 * 60 * 1000 // 15 minutos
const BLOCK_DURATION_MS = 30 * 60 * 1000 // 30 minutos
```

**Almacenamiento:**
- In-memory Map (se reinicia con el servidor)
- Cleanup automático cada 5 minutos
- En producción considerar usar Redis

### 2. **Verificación de Rol ADMIN**
**Ubicación:** [`lib/supabase-admin.ts`](lib/supabase-admin.ts)

```typescript
export async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error("No autenticado")

  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (userData?.role !== "ADMIN") {
    throw new Error("No autorizado - Se requiere rol ADMIN")
  }

  return user
}
```

**Usado en:** TODAS las server actions de admin

### 3. **Middleware de Rutas**
**Ubicación:** [`utils/supabase/middleware.ts`](utils/supabase/middleware.ts)

**Protecciones:**
- Verifica autenticación antes de acceder a `/admin/*`
- Verifica que el rol sea ADMIN
- Redirige a `/admin-login` si no está autenticado
- Redirige a `/panel-cpa` si el rol no es ADMIN
- Early return para `/admin-login` (evita loops)

### 4. **Service Role Key**
**Ubicación:** `.env` (variable `SUPABASE_SERVICE_ROLE_KEY`)

**Uso:**
```typescript
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // ✅ Bypass RLS
  { auth: { autoRefreshToken: false, persistSession: false } }
)
```

**Ventajas:**
- Bypass completo de RLS
- No necesita políticas adicionales
- Operaciones sin restricciones

**Riesgos:**
- Si se expone, acceso total a DB
- Solo usar en server-side
- Nunca exponer en cliente

### 5. **Admin Layout Server Component**
**Ubicación:** [`app/(main)/admin/layout.tsx`](app/(main)/admin/layout.tsx)

**Validación server-side:**
```typescript
export default async function AdminLayout({ children }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/admin-login')

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userData?.role !== 'ADMIN') redirect('/panel-cpa')

  return <AdminSidebar>{children}</AdminSidebar>
}
```

---

## Mejoras Futuras

### Seguridad 🔒

#### Crítico - Implementar pronto:
1. **Audit Logs**
   - Tabla `admin_audit_log` con historial de cambios
   - Registrar quién hizo qué, cuándo y qué cambió
   - Vista de logs en `/admin/audit-log`

2. **2FA (Two-Factor Authentication)**
   - TOTP para admin login
   - Códigos de respaldo
   - Usar `@epic-web/totp`

3. **Redis para Rate Limiting**
   - Persistencia entre reinic ios del servidor
   - Upstash Redis o Redis local
   - Shared state en ambientes multi-instancia

#### Importante:
4. **Múltiples niveles de admin**
   - SUPER_ADMIN: acceso total
   - ADMIN_TOURNAMENTS: solo torneos
   - ADMIN_USERS: solo usuarios/jugadores

5. **IP Whitelist**
   - Variable `ADMIN_ALLOWED_IPS` en .env
   - Solo permitir desde IPs conocidas

6. **Session timeout corto**
   - Expiración de sesión en 1 hora
   - Re-autenticación para acciones críticas

#### Nice to have:
7. **Confirmación de contraseña para acciones destructivas**
   - Pedir contraseña antes de cancelar torneo
   - Pedir contraseña antes de revertir estados

8. **Webhooks de notificaciones**
   - Discord/Slack cuando alguien hace login como admin
   - Alertas por acciones destructivas

9. **Modo de solo lectura**
   - Variable `ADMIN_READ_ONLY_MODE=true`
   - Permite ver pero no modificar

### Funcionalidades 🚀

1. **Gestión de Matches** (`/admin/matches`)
   - CRUD de partidos
   - Cambiar resultados
   - Reasignar canchas/horarios

2. **Bulk Operations**
   - Importar jugadores desde CSV
   - Exportar datos a Excel
   - Operaciones masivas

3. **Dashboard mejorado**
   - Gráficos de actividad
   - Estadísticas en tiempo real
   - Últimas acciones

4. **Búsqueda global**
   - Buscar en todas las entidades
   - Filtros avanzados
   - Autocompletado

5. **Vista de logs de actividad**
   - Ver quién editó qué
   - Historial de cambios
   - Rollback de acciones

### UX/UI 🎨

1. **Paginación**
   - Tablas paginadas para grandes datasets
   - Server-side pagination

2. **Exportación de datos**
   - Exportar tablas a CSV/Excel
   - Informes personalizados

3. **Modo oscuro**
   - Tema oscuro para admin panel
   - Toggle en sidebar

4. **Shortcuts de teclado**
   - `Ctrl+K` para búsqueda global
   - Navegación con teclado

---

## Troubleshooting

### Problema: "No autorizado - Se requiere rol ADMIN"
**Solución:** Verificar que el usuario tiene `role = 'ADMIN'` en la tabla `users`
```sql
SELECT id, email, role FROM users WHERE email = 'admin@padel-cpa.com';
```

### Problema: "Tu IP está bloqueada por 30 minutos"
**Solución 1:** Esperar 30 minutos
**Solución 2:** Reiniciar el servidor (limpia el Map en memoria)
**Solución 3 (dev):** Modificar `MAX_ATTEMPTS` en `lib/rate-limit.ts`

### Problema: Acciones de torneos no funcionan (no eliminan datos)
**Causa:** Las funciones no usan `supabaseAdmin`
**Solución:** Verificar que las server actions usan `supabaseAdmin` en lugar de `createClient()`

### Problema: 404 en rutas de admin
**Causa:** Falta el archivo page.tsx
**Solución:** Verificar que existe `app/(main)/admin/[module]/page.tsx`

### Problema: Middleware redirige a /admin-login en loop
**Causa:** Falta early return para /admin-login
**Solución:** Verificar que el middleware tiene:
```typescript
if (currentPath === ADMIN_LOGIN_PATH) {
  if (!user) return response
}
```

---

## Checklist de Producción

Antes de deployment:

- [ ] Cambiar contraseña de admin
- [ ] Configurar `SUPABASE_SERVICE_ROLE_KEY` en variables de entorno
- [ ] Implementar Redis para rate limiting
- [ ] Implementar audit logs
- [ ] Configurar 2FA
- [ ] Revisar IP whitelist
- [ ] Configurar alertas de seguridad
- [ ] Backup de base de datos antes de usar acciones destructivas
- [ ] Documentar procedimientos de emergencia
- [ ] Capacitar a admins sobre uso correcto

---

## Contacto y Soporte

Para reportar bugs o solicitar features del panel de admin:
- Crear issue en el repositorio
- Etiquetar con `admin-panel`
- Incluir logs y pasos para reproducir

---

**Última actualización:** 2025-01-08
**Versión del panel:** 1.0.0
**Mantenedor:** Equipo de Desarrollo
