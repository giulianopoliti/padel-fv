# Sistema de Permisos de Torneos - Especificación Completa

## Introducción

Este documento especifica el sistema de permisos y accesos para torneos en la plataforma de gestión de torneos de pádel.

## Niveles de Acceso

El sistema define **5 niveles de acceso** distintos:

| Nivel | Descripción | Usuarios que lo obtienen |
|-------|-------------|-------------------------|
| `FULL_MANAGEMENT` | Acceso completo de administración | ADMIN, CLUB owner, ORGANIZADOR owner |
| `PLAYER_ACTIVE` | Acceso como jugador activo | PLAYER inscrito y NO eliminado |
| `PLAYER_ELIMINATED` | Acceso restringido de jugador eliminado | PLAYER inscrito pero eliminado del torneo |
| `PUBLIC_VIEW` | Vista pública del torneo | ORGANIZADOR no owner, PLAYER no inscrito, cualquier usuario autenticado | Usuario no autenticado PUEDE VER tambien. Pero no puede hacer nada. Componente de inscripcion ya se comporta bien por ahora, pero podemos abstraerlo para luego en un futuro sacarlo de aca
| `NO_ACCESS` | Sin acceso (error o usuario inválido) | Usuario sin perfil válido, errores del sistema |

---

## Permisos por Nivel de Acceso

### 🔴 **FULL_MANAGEMENT** (Administración Completa)

**¿Quiénes?**
- ✅ **ADMIN** - Cualquier usuario con rol `ADMIN`
- ✅ **CLUB owner** - Usuario CLUB dueño del club (`clubes.user_id === user.id` y `tournaments.club_id === club.id`)
- ✅ **ORGANIZADOR owner** - Usuario ORGANIZADOR cuya organización es dueña del torneo (`tournaments.organization_id === organization_members.organizacion_id` y `is_active = true`)

**Permisos:**
| Permiso | Descripción | Implementado en |
|---------|-------------|-----------------|
| ✅ `manage_tournament` | Editar configuración del torneo | `app/(main)/tournaments/[id]/settings/*` |
| ✅ `update_results` | Actualizar resultados de partidos | `app/api/tournaments/[id]/matches/[matchId]/update-result` |
| ✅ `manage_inscriptions` | Gestionar inscripciones (aprobar, rechazar, eliminar) | `app/api/tournaments/[id]/actions.ts` |
| ✅ `upload_images` | Subir imágenes del torneo y ganadores | `app/(main)/tournaments/[id]/settings/actions.ts` |
| ✅ `start_tournament` | Iniciar torneo y generar brackets | `app/api/tournaments/[id]/start-tournament` |
| ✅ `cancel_tournament` | Cancelar torneo | `app/api/tournaments/[id]/cancel` |
| ✅ `generate_brackets` | Generar llaves y zonas | `app/api/tournaments/[id]/generate-long-bracket` |
| ✅ `assign_courts` | Asignar canchas a partidos | `app/api/tournaments/[id]/matches/[matchId]/assign-court` |
| ✅ `manage_schedules` | Crear y editar fechas/horarios | `app/(main)/tournaments/[id]/schedules/@organizer` |
| ✅ `view_all_matches` | Ver todos los partidos del torneo | Todas las páginas de gestión |
| ✅ `view_statistics` | Ver estadísticas completas | `app/(main)/tournaments/[id]/zones` |
| ✅ `recategorize_players` | Recategorizar jugadores | `app/api/tournaments/[id]/recategorize-players` |
| ✅ `modify_tournament_status` | Cambiar estado del torneo (zona → bracket, etc.) | `app/api/tournaments/[id]/modify-status-tournament/*` |

**Páginas Accesibles:**
- ✅ `/tournaments/[id]` - Vista completa del torneo
- ✅ `/tournaments/[id]/settings` - Configuración
- ✅ `/tournaments/[id]/zones` - Gestión de zonas
- ✅ `/tournaments/[id]/bracket` - Gestión de llaves
- ✅ `/tournaments/[id]/matches` - Todos los partidos
- ✅ `/tournaments/[id]/schedules` - Vista organizador con edición
- ✅ `/tournaments/[id]/schedule-management` - Gestión avanzada de fechas
- ✅ `/tournaments/[id]/match-scheduling` - Programación de partidos

**Componentes Visibles:**
- ✅ Botones de edición/gestión
- ✅ Formularios de carga de resultados
- ✅ Panel de administración
- ✅ Herramientas de organización

---

### 🟢 **PLAYER_ACTIVE** (Jugador Activo)

**¿Quiénes?**
- ✅ Usuario con rol `PLAYER` (o cualquier rol) que está inscrito en el torneo
- ✅ La pareja no está eliminada (`inscriptions.is_eliminated = false`)
- ✅ Puede ser `player1_id` o `player2_id` de la pareja inscrita

**Permisos:**
| Permiso | Descripción | Implementado en |
|---------|-------------|-----------------|
| ✅ `view_public` | Ver información pública del torneo | `app/(main)/tournaments/[id]/page.tsx` |
| ✅ `view_own_matches` | Ver partidos de su pareja | `app/(main)/tournaments/[id]/schedules/@player` |
| ✅ `view_own_schedule` | Ver horarios de sus partidos | `app/(main)/tournaments/[id]/schedules/@player` |
| ✅ `view_own_statistics` | Ver estadísticas de su pareja | Componentes de estadísticas |
| ✅ `view_bracket_position` | Ver su posición en el bracket | `app/(main)/tournaments/[id]/bracket` |
| ✅ `view_zone_position` | Ver su posición en la zona | `app/(main)/tournaments/[id]/zones` |
| ✅ `register_couple` | Inscribir pareja (si inscripciones abiertas) | `app/(main)/tournaments/[id]/components/TournamentLongLayout.tsx` |
| ❌ `edit_tournament` | NO puede editar configuración | - |
| ❌ `update_results` | NO puede cargar resultados | - |
| ❌ `manage_inscriptions` | NO puede gestionar otras inscripciones | - |

**Páginas Accesibles:**
- ✅ `/tournaments/[id]` - Vista pública del torneo
- ✅ `/tournaments/[id]/schedules` - Vista player (solo sus partidos)
- ✅ `/tournaments/[id]/zones` - Vista de zonas (solo lectura)
- ✅ `/tournaments/[id]/bracket` - Vista de llaves (solo lectura)
- ❌ `/tournaments/[id]/settings` - NO accesible
- ❌ `/tournaments/[id]/schedule-management` - NO accesible

**Componentes Visibles:**
- ✅ Lista de sus partidos
- ✅ Horarios de sus partidos
- ✅ Estadísticas de su pareja
- ❌ Botones de edición/gestión

---

### 🟡 **PLAYER_ELIMINATED** (Jugador Eliminado)

**¿Quiénes?**
- ✅ Usuario inscrito en el torneo
- ✅ Su pareja fue eliminada (`inscriptions.is_eliminated = true`)

**Permisos:**
| Permiso | Descripción | Implementado en |
|---------|-------------|-----------------|
| ✅ `view_public` | Ver información pública del torneo | `app/(main)/tournaments/[id]/page.tsx` |
| ✅ `view_own_past_matches` | Ver partidos que jugó antes de ser eliminado | Vista especial |
| ✅ `view_elimination_round` | Ver en qué ronda fue eliminado | `app/(main)/tournaments/[id]/schedules/layout.tsx` |
| ⚠️ `view_bracket_position` | Ver su última posición en el bracket | Solo lectura |
| ❌ `view_own_schedule` | NO puede ver horarios futuros | - |
| ❌ `register_couple` | NO puede inscribirse de nuevo | - |

**Páginas Accesibles:**
- ✅ `/tournaments/[id]` - Vista pública
- ⚠️ `/tournaments/[id]/schedules` - Vista especial de "eliminado" (ya implementada en `schedules/layout.tsx`)
- ✅ `/tournaments/[id]/bracket` - Solo lectura de su progreso
- ❌ Otras páginas restringidas

**Componentes Visibles:**
- ✅ Banner de "Participación finalizada"
- ✅ Historial de partidos jugados
- ✅ Mensaje indicando ronda de eliminación
- ❌ Horarios futuros
- ❌ Funcionalidades de jugador activo

---

### 🔵 **PUBLIC_VIEW** (Vista Pública)

**¿Quiénes?**
- ✅ **ORGANIZADOR NO owner** - Organizador cuya organización NO es dueña del torneo (`tournaments.organization_id ≠ organization_members.organizacion_id` o `tournaments.organization_id IS NULL`)
- ✅ **PLAYER no inscrito** - Usuario PLAYER que NO está inscrito en el torneo
- ✅ **COACH** - Usuarios con rol COACH (pueden inscribir pero no tienen permisos especiales)
- ✅ **Cualquier usuario autenticado** - Usuario logeado sin rol especial

**Permisos:**
| Permiso | Descripción | Implementado en |
|---------|-------------|-----------------|
| ✅ `view_public` | Ver información pública del torneo | `app/(main)/tournaments/[id]/page.tsx` |
| ✅ `view_public_bracket` | Ver llaves públicas | `app/(main)/tournaments/[id]/bracket` |
| ✅ `view_public_zones` | Ver zonas y resultados públicos | `app/(main)/tournaments/[id]/zones` |
| ✅ `view_public_matches` | Ver lista pública de partidos | `app/(main)/tournaments/[id]/matches` |
| ⚠️ `register_couple` | Inscribir pareja (solo PLAYER y COACH) | Según disponibilidad de inscripciones |
| ❌ `view_schedules` | NO puede ver horarios detallados | - |
| ❌ `edit_tournament` | NO puede editar | - |
| ❌ `manage_inscriptions` | NO puede gestionar inscripciones | - |

**Páginas Accesibles:**
- ✅ `/tournaments/[id]` - Vista pública completa
- ✅ `/tournaments/[id]/bracket` - Vista pública de llaves
- ✅ `/tournaments/[id]/zones` - Vista pública de zonas
- ⚠️ `/tournaments/[id]/matches` - Vista pública de partidos (sin detalles sensibles)
- ❌ `/tournaments/[id]/schedules` - NO accesible
- ❌ `/tournaments/[id]/settings` - NO accesible
- ❌ `/tournaments/[id]/schedule-management` - NO accesible

**Componentes Visibles:**
- ✅ Información básica del torneo
- ✅ Brackets/llaves públicas
- ✅ Resultados públicos
- ✅ Botón de inscripción (si aplica)
- ❌ Herramientas de gestión
- ❌ Horarios detallados
- ❌ Estadísticas privadas

---

### ⚫ **NO_ACCESS** (Sin Acceso)

**¿Quiénes?**
- ❌ Usuario sin perfil válido en la base de datos
- ❌ Errores del sistema al verificar permisos
- ❌ Torneo no encontrado

**Permisos:**
- ❌ Ninguno

**Resultado:**
- Redirección a página de error
- Mensaje de "No tienes acceso a este torneo"

---

## Usuarios No Autenticados (GUEST)

**Importante:** Los usuarios **NO logeados** deben tener acceso a:

| Página | Accesible | Notas |
|--------|-----------|-------|
| `/tournaments` | ✅ Sí | Lista pública de torneos |
| `/tournaments/[id]` | ✅ Sí | Vista pública del torneo |
| `/tournaments/[id]/bracket` | ✅ Sí | Brackets públicos |
| `/tournaments/[id]/zones` | ✅ Sí | Zonas públicas |
| Otras páginas | ❌ No | Requieren autenticación |

**Implementación actual:** Middleware en [middleware.ts](../middleware.ts) redirige a `/login` si no está autenticado.

**Pendiente:** Permitir acceso público sin login a páginas específicas.

---

## Matriz de Permisos Completa

| Acción | FULL_MANAGEMENT | PLAYER_ACTIVE | PLAYER_ELIMINATED | PUBLIC_VIEW | NO_ACCESS |
|--------|----------------|---------------|-------------------|-------------|-----------|
| Ver torneo público | ✅ | ✅ | ✅ | ✅ | ❌ |
| Inscribir pareja | ✅ | ✅ (si abierto) | ❌ | ⚠️ (PLAYER/COACH) | ❌ |
| Ver horarios propios | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver todos los horarios | ✅ | ❌ | ❌ | ❌ | ❌ |
| Editar configuración | ✅ | ❌ | ❌ | ❌ | ❌ |
| Cargar resultados | ✅ | ❌ | ❌ | ❌ | ❌ |
| Iniciar torneo | ✅ | ❌ | ❌ | ❌ | ❌ |
| Cancelar torneo | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ver bracket público | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ver zonas públicas | ✅ | ✅ | ✅ | ✅ | ❌ |
| Gestionar inscripciones | ✅ | ❌ | ❌ | ❌ | ❌ |
| Recategorizar | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Implementación Técnica

### Funciones Actuales

```typescript
// Verifica permisos de GESTIÓN (ADMIN, CLUB owner, ORGANIZADOR owner)
checkTournamentPermissions(userId: string, tournamentId: string): Promise<PermissionResult>

// Verifica INSCRIPCIÓN como jugador
checkUserTournamentInscription(userId: string, tournamentId: string): Promise<UserInscriptionResult>

// Combina gestión + inscripción
checkEnhancedTournamentPermissions(userId: string, tournamentId: string): Promise<EnhancedPermissionResult>
```

### Nueva Función Propuesta

```typescript
// Retorna nivel de acceso granular
checkTournamentAccess(userId: string, tournamentId: string): Promise<TournamentAccessResult>

type AccessLevel =
  | 'FULL_MANAGEMENT'
  | 'PLAYER_ACTIVE'
  | 'PLAYER_ELIMINATED'
  | 'PUBLIC_VIEW'
  | 'NO_ACCESS'

interface TournamentAccessResult {
  accessLevel: AccessLevel
  permissions: string[]  // Lista de permisos específicos
  metadata: {
    userRole?: string
    isInscribed?: boolean
    isEliminated?: boolean
    source?: 'admin' | 'club_owner' | 'organization_member' | 'player' | 'public'
  }
}
```

---

## Casos de Uso Específicos

### Caso 1: ORGANIZADOR viendo torneo de otro club

**Contexto:**
- Usuario: `ORGANIZADOR` de organización A
- Torneo: Pertenece a organización B (o a un CLUB sin organización)

**Resultado esperado:**
- `accessLevel`: `PUBLIC_VIEW`
- Puede ver información pública
- NO puede gestionar el torneo
- NO puede ver horarios privados

### Caso 2: PLAYER inscrito pero eliminado

**Contexto:**
- Usuario: `PLAYER` inscrito en el torneo
- Estado: `is_eliminated = true`

**Resultado esperado:**
- `accessLevel`: `PLAYER_ELIMINATED`
- Puede ver su progreso hasta la eliminación
- NO puede ver horarios futuros
- Recibe mensaje de "Participación finalizada"

### Caso 3: ADMIN viendo cualquier torneo

**Contexto:**
- Usuario: `ADMIN`

**Resultado esperado:**
- `accessLevel`: `FULL_MANAGEMENT`
- Acceso total a cualquier torneo
- Todas las funcionalidades disponibles

### Caso 4: Usuario sin login

**Contexto:**
- Usuario: No autenticado

**Resultado esperado:**
- Middleware permite acceso a páginas públicas
- Puede ver torneos, brackets, zonas
- Debe login para inscribirse

---

## Testing

Ver archivo de tests: [utils/__tests__/tournament-permissions.test.ts](../utils/__tests__/tournament-permissions.test.ts)

**Escenarios cubiertos:**
- ✅ ADMIN con acceso total
- ✅ CLUB owner con acceso a su torneo
- ✅ CLUB sin acceso a torneo de otro club
- ✅ ORGANIZADOR owner con acceso a torneo de su organización
- ✅ ORGANIZADOR sin acceso a torneo de otra organización
- ✅ PLAYER inscrito como player1
- ✅ PLAYER inscrito como player2
- ✅ PLAYER eliminado
- ✅ PLAYER no inscrito
- ✅ Manejo de errores (usuario no encontrado, torneo no encontrado)

---

## Migraciones Pendientes

### Componentes que necesitan actualización:

1. **Layouts con routing condicional:**
   - [app/(main)/tournaments/[id]/schedules/layout.tsx](../app/(main)/tournaments/[id]/schedules/layout.tsx) ✅ Ya usa sistema combinado
   - Otros layouts que puedan necesitar lógica similar

2. **Hooks de permisos:**
   - [hooks/use-tournament-editable.ts](../hooks/use-tournament-editable.ts) - Considerar usar nueva función
   - [app/(main)/tournaments/[id]/components/permissions/usePermissions.tsx](../app/(main)/tournaments/[id]/components/permissions/usePermissions.tsx) - Actualizar tipos de permisos

3. **API Routes que verifican permisos:**
   - Todos los routes en `app/api/tournaments/[id]/*` - Validar que usan correctamente las funciones

4. **Middleware:**
   - [middleware.ts](../middleware.ts) - Permitir acceso público a páginas específicas

---

## Changelog

### Version 1.0 (Actual)
- ✅ Sistema de permisos básico implementado
- ✅ Verificación de ADMIN, CLUB owner, ORGANIZADOR
- ✅ Verificación de inscripción de jugadores
- ✅ Sistema combinado de permisos

### Version 1.1 (Propuesta)
- ⏳ Niveles de acceso granulares
- ⏳ Vista pública definida
- ⏳ Función `checkTournamentAccess()`
- ⏳ Tests completos
- ⏳ Documentación completa

---

**Última actualización:** 2025-10-27
**Mantenedor:** Sistema de Torneos de Pádel
