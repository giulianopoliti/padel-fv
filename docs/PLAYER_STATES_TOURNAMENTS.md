# Estados de Jugador en Torneos LONG

## Resumen

Sistema completo de manejo de estados para jugadores en torneos tipo LONG con diferentes niveles de acceso según el estado de inscripción y eliminación.

## Estados Implementados

### 1. **Usuario No Logeado**
- **Vista:** `NotRegisteredView`
- **Acceso:** Puede ver información del torneo
- **Restricciones:** No puede acceder a funciones interactivas
- **Mensaje:** "No estás inscripto en este torneo"

### 2. **Player No Inscripto**
- **Vista:** `NotRegisteredView`
- **Acceso:** Puede ver información del torneo + botón a inscripciones
- **Restricciones:** No ve sidebar
- **Mensaje:** "¿Quieres participar? Ir a Inscripciones"

### 3. **Player Inscripto Activo**
- **Vista:** `PlayerTournamentDashboard` (normal)
- **Acceso:** Dashboard completo con próximos partidos y estadísticas
- **Sidebar:** Completa EXCEPTO "Settings"
- **Mensaje:** "¡Estás inscripto! Puedes ver tu progreso"

### 4. **Player Inscripto Eliminado**
- **Vista:** `EliminatedPlayerView`
- **Acceso:** Historial completo hasta donde llegó
- **Sidebar:** Restringida (NO ve "Fechas y Horarios")
- **Mensaje:** "Has sido eliminado en [ronda] el [fecha]"

### 5. **Organizador/Club**
- **Vista:** Dashboard de organizador
- **Acceso:** Completo incluyendo Settings
- **Sidebar:** Todas las opciones disponibles

## Restricciones de Acceso

### Settings (`/tournaments/[id]/settings`)
- ✅ **Permitido:** CLUB, ORGANIZADOR
- ❌ **Bloqueado:** PLAYER, usuarios no logeados
- **Implementación:** Layout con `checkTournamentPermissions`

### Fechas y Horarios (`/tournaments/[id]/schedules`)
- ✅ **Permitido:** CLUB, ORGANIZADOR, PLAYER activo
- ❌ **Bloqueado:** PLAYER eliminado, usuarios no logeados
- **Vista especial:** `EliminatedPlayerSchedulesView` para players eliminados

## Archivos Modificados

### Core Logic
- `utils/player-matches.ts` - Lógica corregida para detectar players en parejas
- `utils/tournament-permissions.ts` - Sistema de permisos existente

### Components
- `components/player/PlayerTournamentDashboard.tsx` - Estados de player
- `components/tournament/NotRegisteredView.tsx` - Vista para no inscritos
- `app/(main)/tournaments/[id]/components/LongTournamentView.tsx` - Router principal
- `app/(main)/tournaments/[id]/components/TournamentLongSidebar.tsx` - Navegación restringida

### Layouts de Protección
- `app/(main)/tournaments/[id]/settings/layout.tsx` - Protección de Settings
- `app/(main)/tournaments/[id]/schedules/layout.tsx` - Manejo de players eliminados

## Lógica de Inscripción

### Problema Resuelto
- **Anterior:** Solo verificaba `inscriptions.player_id = playerId`
- **Nuevo:** Verifica `couples.player1_id OR couples.player2_id = playerId`
- **Resultado:** Ambos players de una pareja son detectados correctamente

### Query Corregida
```typescript
// Busca inscripciones con JOIN a parejas
const { data: inscriptions } = await supabase
  .from('inscriptions')
  .select(`
    id, couple_id, is_eliminated, eliminated_at, eliminated_in_round,
    couples!inner (id, player1_id, player2_id)
  `)
  .eq('tournament_id', tournamentId)

// Encuentra al player en cualquier posición de la pareja
const playerInscription = inscriptions.find(inscription => {
  const couple = inscription.couples
  return couple.player1_id === playerId || couple.player2_id === playerId
})
```

## Indicadores Visuales

- **Player Activo:** Icono azul en sidebar
- **Player Eliminado:** Icono rojo + texto "Eliminado - [Ronda]"
- **Settings Protegido:** Página de "Acceso Denegado"
- **Schedules Restringido:** "Participación Finalizada" con botón a progreso