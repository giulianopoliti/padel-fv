# Sistema de Detección de Conflictos de Zona

## 📋 Resumen

Sistema que detecta y alerta cuando dos parejas que ya se enfrentaron en la fase de zonas están programadas para jugar nuevamente en el bracket de eliminación.

**Estado:** ✅ Implementado y Funcional

**Fecha:** 2025-01-XX

---

## 🎯 Objetivo

Alertar visualmente al organizador del torneo cuando un match en el bracket de eliminación involucra parejas que ya jugaron en la fase de zonas, permitiendo reorganizar el bracket si es necesario.

---

## 🏗️ Arquitectura

### 1. **Hook: useZoneMatchHistory**

**Ubicación:** `components/tournament/bracket-v2/hooks/useZoneMatchHistory.ts`

**Responsabilidad:**
- Consulta todos los matches finalizados con round='ZONE' del torneo
- Resuelve `tournament_couple_seed_id` a `couple_id` real
- Construye un Map bidireccional de enfrentamientos históricos
- Cache con SWR para performance óptima

**Interfaz:**
```typescript
interface ZoneMatchHistoryResult {
  history: Map<string, Set<string>>  // couple_id -> Set<opponent_couple_ids>
  matches: ZoneMatchInfo[]           // Lista de matches procesados
  isLoading: boolean
  error: Error | null
}
```

**Uso:**
```typescript
const { history, isLoading } = useZoneMatchHistory(tournamentId)
```

---

### 2. **Utilidad: couple-resolver**

**Ubicación:** `components/tournament/bracket-v2/utils/couple-resolver.ts`

**Responsabilidad:**
- Resolver IDs reales de parejas desde match data
- Manejar tanto `couple_id` directo como `tournament_couple_seed_id`
- Proporcionar helpers para validaciones comunes

**Función Principal:**
```typescript
function resolveCoupleIds(
  match: BracketMatchV2,
  seeds: SeedInfo[]
): ResolvedCoupleIds

interface ResolvedCoupleIds {
  couple1Id: string | null
  couple2Id: string | null
  slot1FromSeed: boolean
  slot2FromSeed: boolean
  bothDefined: boolean
}
```

**Helpers Adicionales:**
- `resolveSlotCoupleId()` - Resolver un slot específico
- `hasMatchBothCouples()` - Verificar si match puede jugarse
- `canMatchBePlayed()` - Verificar si match está listo y pendiente
- `hasUnresolvedPlaceholders()` - Detectar placeholders sin resolver

---

### 3. **Componente Visual: ZoneConflictBadge**

**Ubicación:** `components/tournament/bracket-v2/components/ZoneConflictBadge.tsx`

**Responsabilidad:**
- Mostrar alerta visual de conflicto
- Tooltip informativo con detalles
- Variantes de diseño (warning/info)

**Props:**
```typescript
interface ZoneConflictBadgeProps {
  couple1Name?: string
  couple2Name?: string
  variant?: 'warning' | 'info'
  size?: 'sm' | 'md' | 'lg'
  iconOnly?: boolean
  className?: string
}
```

**Variantes Pre-configuradas:**
- `ZoneConflictIconBadge` - Solo ícono, para espacios reducidos
- `ZoneConflictInfoBadge` - Variante informativa menos alarmante

---

### 4. **Integración: GranularMatchCard**

**Ubicación:** `components/tournament/bracket-v2/components/GranularMatchCard.tsx`

**Cambios Realizados:**
1. Import de nuevos módulos (hook, utils, badge)
2. Agregado prop `seeds?: SeedInfo[]`
3. Uso de `useZoneMatchHistory` para obtener historial
4. Uso de `resolveCoupleIds` para obtener IDs reales
5. Uso de `havePlayedInZone` para detectar conflicto
6. Renderizado de `ZoneConflictBadge` en header de card

**Código Clave:**
```typescript
// Obtener historial
const { history } = useZoneMatchHistory(tournamentId)

// Resolver IDs
const { couple1Id, couple2Id, bothDefined } = resolveCoupleIds(match, seeds)

// Detectar conflicto
const hasZoneConflict = bothDefined && havePlayedInZone(history, couple1Id, couple2Id)

// Renderizar badge si hay conflicto
{hasZoneConflict && (
  <ZoneConflictBadge
    couple1Name={couple1Name}
    couple2Name={couple2Name}
    variant="warning"
    size="sm"
  />
)}
```

---

### 5. **Propagación: ImprovedBracketRenderer**

**Ubicación:** `components/tournament/bracket-v2/components/ImprovedBracketRenderer.tsx`

**Cambio:**
- Pasar `bracketData.seeds` a cada `GranularMatchCard`

```typescript
<GranularMatchCard
  ...props
  seeds={bracketData.seeds}
/>
```

---

## 🔍 Flujo de Datos

```
1. User abre página de bracket
   ↓
2. ImprovedBracketRenderer renderiza matches
   ↓
3. GranularMatchCard para cada match:
   a. useZoneMatchHistory consulta DB (1 vez por torneo)
   b. resolveCoupleIds obtiene couple IDs reales
   c. havePlayedInZone verifica contra historial
   d. Si conflicto → renderiza ZoneConflictBadge
   ↓
4. Usuario ve badge amarillo en matches conflictivos
   ↓
5. Hover sobre badge → tooltip con detalles
   ↓
6. Organizador puede reorganizar con "Modo Edición"
```

---

## 🎨 UX/UI

### Estado Normal (Sin Conflicto)
```
┌────────────────────────────────┐
│ 🏆 SEMIFINAL - Match 1         │
│                                 │
│  Pareja A                       │
│       VS                        │
│  Pareja B                       │
└────────────────────────────────┘
```

### Estado con Conflicto
```
┌────────────────────────────────┐
│ 🏆 SEMIFINAL - Match 1  ⚠️     │
│                                 │
│  Pareja A                       │
│       VS                        │
│  Pareja B                       │
└────────────────────────────────┘
     ↑
     Badge amarillo con tooltip:
     "⚠️ Estas parejas ya jugaron
      en la fase de zonas"
```

---

## 📊 Performance

### Optimizaciones Implementadas:

1. **SWR Cache:**
   - 1 query por torneo (no 1 por match)
   - Deduping de 60 segundos
   - No revalidate on focus (datos históricos)

2. **Resolución O(1):**
   - Map/Set para búsquedas constantes
   - Sin loops anidados

3. **Lazy Evaluation:**
   - Solo calcula si `bothDefined === true`
   - Badge solo renderiza si `hasZoneConflict === true`

4. **Memoización:**
   - `useMemo` en resolución de nombres de parejas
   - Evita recalculos innecesarios

### Benchmarks Esperados:
- Query inicial: ~50-200ms (depende de # matches de zona)
- Verificación por match: <1ms (lookup en Map)
- Render de badge: <5ms
- **Total overhead por match:** <10ms

---

## ✅ Testing

### Escenarios a Probar:

#### 1. ✅ Parejas con `couple_id` directo
```typescript
match = {
  participants: {
    slot1: { couple: { id: 'couple-1' } },
    slot2: { couple: { id: 'couple-2' } }
  }
}
```
**Esperado:** Detecta conflicto si couple-1 y couple-2 jugaron en zonas

#### 2. ✅ Parejas via `tournament_couple_seed_id`
```typescript
match = {
  participants: {
    slot1: { seed: { couple_id: 'couple-1' } },
    slot2: { seed: { couple_id: 'couple-2' } }
  }
}
```
**Esperado:** Resuelve seeds y detecta conflicto

#### 3. ✅ Mix de ambos casos
```typescript
match = {
  participants: {
    slot1: { couple: { id: 'couple-1' } },
    slot2: { seed: { couple_id: 'couple-2' } }
  }
}
```
**Esperado:** Resuelve correctamente y detecta conflicto

#### 4. ✅ Match sin parejas asignadas
```typescript
match = {
  participants: {
    slot1: { type: 'placeholder' },
    slot2: { type: 'empty' }
  }
}
```
**Esperado:** No muestra badge (bothDefined === false)

#### 5. ✅ Match con placeholders sin resolver
```typescript
match = {
  participants: {
    slot1: { type: 'placeholder', placeholder: { display: 'Ganador Zona A' } },
    slot2: { couple: { id: 'couple-1' } }
  }
}
```
**Esperado:** No muestra badge hasta que placeholder se resuelva

#### 6. ✅ Parejas que NO jugaron en zonas
```typescript
// couple-1 jugó vs couple-3 en zonas
// couple-2 jugó vs couple-4 en zonas
// Pero couple-1 nunca jugó vs couple-2

match = {
  participants: {
    slot1: { couple: { id: 'couple-1' } },
    slot2: { couple: { id: 'couple-2' } }
  }
}
```
**Esperado:** NO muestra badge (sin conflicto)

---

## 🚀 Cómo Usar

### Para Desarrolladores

```typescript
// 1. En cualquier componente que renderiza matches:
import { useZoneMatchHistory, havePlayedInZone } from '@/hooks/useZoneMatchHistory'
import { resolveCoupleIds } from '@/utils/couple-resolver'

// 2. Usar el hook
const { history, isLoading } = useZoneMatchHistory(tournamentId)

// 3. Resolver IDs de un match
const { couple1Id, couple2Id } = resolveCoupleIds(match, seeds)

// 4. Verificar conflicto
const hasConflict = havePlayedInZone(history, couple1Id, couple2Id)

// 5. Mostrar alerta si necesario
{hasConflict && <ZoneConflictBadge />}
```

### Para Usuarios (Organizadores)

1. **Ver conflictos:** Los badges amarillos aparecen automáticamente en matches conflictivos
2. **Detalles:** Hover sobre el badge para ver qué parejas están involucradas
3. **Reorganizar:** Usar botón "🔄 Reorganizar Parejas" → Modo Edición → Drag & drop
4. **Guardar:** Botón "Guardar cambios" para aplicar reorganización

---

## 🔧 Mantenimiento

### Archivos a Actualizar si Cambia la DB:

1. **useZoneMatchHistory.ts:**
   - Query de matches (línea ~75)
   - Query de seeds (línea ~99)

2. **couple-resolver.ts:**
   - Lógica de resolución si cambia estructura de `BracketMatchV2`

### Posibles Mejoras Futuras:

1. **Cache persistente:** LocalStorage para historial de zonas
2. **Sugerencias automáticas:** Proponer swaps para evitar conflictos
3. **Modo batch:** Resolver todos los conflictos de una vez
4. **Estadísticas:** Dashboard con % de conflictos por torneo
5. **Notificaciones:** Alert al generar bracket si hay conflictos potenciales

---

## 📝 Notas Técnicas

### Por qué SWR y no React Query
- Ya usado en el proyecto
- Menor bundle size
- Deduping automático

### Por qué Map y Set
- O(1) lookups
- Claro y semántico
- Nativo en JS moderno

### Por qué no bloqueante
- Permite casos especiales (rematches intencionales)
- Organizer tiene control final
- Alerta informativa, no error

---

## 🐛 Troubleshooting

### Badge no aparece
1. Verificar que `tournamentId` es correcto
2. Verificar que hay matches de zona finalizados
3. Check console por errores de Supabase
4. Verificar que `seeds` prop está siendo pasado

### Performance lento
1. Revisar número de matches de zona (>1000 puede ser lento)
2. Verificar índices de DB en tabla `matches`
3. Considerar pagination si >5000 matches

### False positives
1. Verificar resolución de seeds correcta
2. Check que `es_prueba` está filtrado en query
3. Verificar que solo se consultan matches tipo 'ZONE'

---

## 👥 Contacto

**Implementado por:** Claude Code Assistant
**Revisado por:** [Pendiente]
**Aprobado por:** [Pendiente]

---

## 📄 Licencia

Parte del sistema de gestión de torneos de Padel.
Todos los derechos reservados.
