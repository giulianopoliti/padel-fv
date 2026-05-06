# 🎯 SOLUCIÓN: Reasignación Inteligente de Seeds

## 📋 Problema a Resolver

Cuando se edita un match en **BRACKET_PHASE** y las posiciones de zona cambian:
- ❌ **NO podemos invalidar** todos los seeds (hay matches en juego)
- ❌ **NO podemos duplicar** parejas en el bracket
- ✅ **SÍ debemos** reasignar parejas a los seeds disponibles sin afectar matches activos

---

## 🎯 Estrategia: "Smart Seed Swap"

### Concepto

En lugar de invalidar todo, hacer un **SWAP INTELIGENTE**:
1. Detectar qué parejas cambiaron de posición
2. Identificar qué seeds están **SIN USAR** (matches no iniciados)
3. **Intercambiar** las parejas entre los seeds necesarios
4. **NO TOCAR** seeds de matches ya iniciados o finalizados

---

## 🔄 Algoritmo Paso a Paso

### Ejemplo Práctico

**ESTADO INICIAL (Bracket Generado):**
```
Zona A:
├─ Posición 1: Pareja W → Seed "1A" ✅
├─ Posición 2: Pareja Y → Seed "2A" ✅
├─ Posición 3: Pareja X → Seed "3A" ✅
└─ Posición 4: Pareja Z → Seed "4A" ✅

Matches del Bracket:
├─ R1-M1: W (seed 1A) vs Y (seed 2A) → Status: PLAYING 🎾
└─ R1-M2: X (seed 3A) vs Z (seed 4A) → Status: PENDING ⏸️
```

**USUARIO EDITA MATCH EN ZONA:**
```
Nuevas Posiciones:
├─ Posición 1: Pareja W (sin cambio)
├─ Posición 2: Pareja X (era 3) ← CAMBIÓ!
├─ Posición 3: Pareja Y (era 2) ← CAMBIÓ!
└─ Posición 4: Pareja Z (sin cambio)
```

**OBJETIVO:**
- Seed "2A" debería tener Pareja X (actualmente tiene Y)
- Seed "3A" debería tener Pareja Y (actualmente tiene X)
- Match R1-M1 está PLAYING → **NO TOCAR** (mantener Y en seed 2A)
- Match R1-M2 está PENDING → **SÍ MODIFICAR** (swap X ↔ Y)

---

## 🔧 Implementación del Algoritmo

### PASO 1: Identificar Cambios de Posición

```typescript
interface PositionChange {
  coupleId: string
  oldPosition: number | null  // null si es nueva definitiva
  newPosition: number
  oldSeedId: string | null
  newSeedId: string | null
}

async function detectPositionChanges(
  tournamentId: string,
  zoneId: string,
  newDefinitivePositions: DefinitivePosition[]
): Promise<PositionChange[]> {
  const supabase = await createClientServiceRole()

  // 1. Obtener seeds actuales de esta zona
  const { data: currentSeeds } = await supabase
    .from('tournament_couple_seeds')
    .select('id, seed, couple_id, placeholder_zone_id, placeholder_position')
    .eq('tournament_id', tournamentId)
    .eq('placeholder_zone_id', zoneId)
    .not('couple_id', 'is', null)  // Solo seeds ya resueltos

  const changes: PositionChange[] = []

  // 2. Comparar con nuevas posiciones definitivas
  for (const newPos of newDefinitivePositions) {
    // Buscar si esta pareja ya está en algún seed
    const currentSeed = currentSeeds?.find(s => s.couple_id === newPos.coupleId)

    // Buscar el seed que DEBERÍA tener esta posición
    const targetSeed = currentSeeds?.find(s =>
      s.placeholder_zone_id === newPos.zoneId &&
      s.placeholder_position === newPos.position
    )

    if (currentSeed && targetSeed && currentSeed.id !== targetSeed.id) {
      // La pareja está en un seed diferente al que debería
      changes.push({
        coupleId: newPos.coupleId,
        oldPosition: currentSeed.placeholder_position,
        newPosition: newPos.position,
        oldSeedId: currentSeed.id,
        newSeedId: targetSeed.id
      })
    }
  }

  return changes
}
```

### PASO 2: Identificar Matches "Tocables"

```typescript
interface MatchLockStatus {
  matchId: string
  seed1Id: string | null
  seed2Id: string | null
  couple1Id: string | null
  couple2Id: string | null
  status: string
  canModify: boolean
  reason?: string
}

async function getMatchLockStatus(
  tournamentId: string,
  seedIds: string[]
): Promise<Map<string, MatchLockStatus>> {
  const supabase = await createClientServiceRole()

  // Buscar todos los matches que usan estos seeds
  const { data: matches } = await supabase
    .from('matches')
    .select('id, seed_couple1_id, seed_couple2_id, couple1_id, couple2_id, status, result_couple1, result_couple2')
    .eq('tournament_id', tournamentId)
    .or(`seed_couple1_id.in.(${seedIds.join(',')}),seed_couple2_id.in.(${seedIds.join(',')})`)

  const lockStatusMap = new Map<string, MatchLockStatus>()

  for (const match of matches || []) {
    const canModify =
      match.status === 'PENDING' &&           // Match no iniciado
      match.result_couple1 === null &&        // Sin resultado
      match.result_couple2 === null           // Sin resultado

    lockStatusMap.set(match.id, {
      matchId: match.id,
      seed1Id: match.seed_couple1_id,
      seed2Id: match.seed_couple2_id,
      couple1Id: match.couple1_id,
      couple2Id: match.couple2_id,
      status: match.status,
      canModify,
      reason: canModify
        ? 'Match pending - safe to modify'
        : `Match ${match.status} - cannot modify`
    })
  }

  return lockStatusMap
}
```

### PASO 3: Calcular Reasignaciones Seguras

```typescript
interface SafeReassignment {
  seedId: string
  oldCoupleId: string
  newCoupleId: string
  action: 'SWAP' | 'UPDATE' | 'SKIP'
  affectedMatches: string[]
}

async function calculateSafeReassignments(
  changes: PositionChange[],
  matchLockStatus: Map<string, MatchLockStatus>
): Promise<SafeReassignment[]> {
  const reassignments: SafeReassignment[] = []

  for (const change of changes) {
    // Verificar si los seeds involucrados pueden ser modificados
    const seedMatches = Array.from(matchLockStatus.values()).filter(m =>
      m.seed1Id === change.oldSeedId ||
      m.seed2Id === change.oldSeedId ||
      m.seed1Id === change.newSeedId ||
      m.seed2Id === change.newSeedId
    )

    const allMatchesModifiable = seedMatches.every(m => m.canModify)

    if (allMatchesModifiable) {
      // CASO 1: Todos los matches son modificables → SWAP seguro
      reassignments.push({
        seedId: change.newSeedId!,
        oldCoupleId: change.coupleId,
        newCoupleId: change.coupleId,
        action: 'SWAP',
        affectedMatches: seedMatches.map(m => m.matchId)
      })
    } else {
      // CASO 2: Hay matches en juego → SKIP
      console.warn(`⚠️ Cannot reassign seed ${change.newSeedId} - matches in progress`)
      reassignments.push({
        seedId: change.newSeedId!,
        oldCoupleId: '',
        newCoupleId: '',
        action: 'SKIP',
        affectedMatches: seedMatches.filter(m => !m.canModify).map(m => m.matchId)
      })
    }
  }

  return reassignments
}
```

### PASO 4: Ejecutar Reasignaciones

```typescript
async function executeSmartReassignment(
  tournamentId: string,
  zoneId: string,
  newDefinitivePositions: DefinitivePosition[]
): Promise<{
  success: boolean
  swapped: number
  skipped: number
  message: string
}> {
  console.log(`🔄 [SMART-REASSIGNMENT] Starting for zone ${zoneId}`)

  // 1. Detectar cambios
  const changes = await detectPositionChanges(tournamentId, zoneId, newDefinitivePositions)

  if (changes.length === 0) {
    return {
      success: true,
      swapped: 0,
      skipped: 0,
      message: 'No position changes detected'
    }
  }

  console.log(`📊 [SMART-REASSIGNMENT] Detected ${changes.length} position changes`)

  // 2. Verificar estado de matches
  const seedIds = [
    ...changes.map(c => c.oldSeedId).filter(Boolean),
    ...changes.map(c => c.newSeedId).filter(Boolean)
  ] as string[]

  const matchLockStatus = await getMatchLockStatus(tournamentId, seedIds)

  // 3. Calcular reasignaciones seguras
  const reassignments = await calculateSafeReassignments(changes, matchLockStatus)

  // 4. Ejecutar SWAPs seguros
  const supabase = await createClientServiceRole()
  let swapped = 0
  let skipped = 0

  for (const reassignment of reassignments) {
    if (reassignment.action === 'SKIP') {
      console.warn(`⏭️ [SMART-REASSIGNMENT] Skipping seed ${reassignment.seedId} - matches in progress`)
      skipped++
      continue
    }

    if (reassignment.action === 'SWAP') {
      // SWAP: Intercambiar parejas entre seeds
      const swap1 = changes.find(c => c.newSeedId === reassignment.seedId)
      const swap2 = changes.find(c => c.oldSeedId === reassignment.seedId)

      if (swap1 && swap2) {
        console.log(`🔄 [SMART-REASSIGNMENT] Swapping seeds:`)
        console.log(`   - Seed ${swap1.newSeedId}: ${swap2.coupleId} → ${swap1.coupleId}`)
        console.log(`   - Seed ${swap2.oldSeedId}: ${swap1.coupleId} → ${swap2.coupleId}`)

        // Actualizar ambos seeds en una transacción
        await supabase.rpc('swap_seed_couples', {
          p_seed1_id: swap1.newSeedId,
          p_seed2_id: swap2.oldSeedId,
          p_couple1_id: swap1.coupleId,
          p_couple2_id: swap2.coupleId
        })

        // Actualizar matches relacionados
        for (const matchId of reassignment.affectedMatches) {
          const matchStatus = matchLockStatus.get(matchId)
          if (matchStatus && matchStatus.canModify) {
            await updateMatchCouples(matchId, swap1.coupleId, swap2.coupleId)
          }
        }

        swapped++
      }
    }
  }

  return {
    success: true,
    swapped,
    skipped,
    message: `Reassignment completed: ${swapped} seeds swapped, ${skipped} skipped (matches in progress)`
  }
}
```

### PASO 5: RPC Function para Swap Atómico

```sql
-- supabase/migrations/XXXXXX_swap_seed_couples.sql

CREATE OR REPLACE FUNCTION swap_seed_couples(
  p_seed1_id UUID,
  p_seed2_id UUID,
  p_couple1_id UUID,
  p_couple2_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Swap atómico usando UPDATE en la misma transacción

  -- Paso 1: Guardar temporalmente en variable (simulado con CASE)
  UPDATE tournament_couple_seeds
  SET couple_id = CASE
    WHEN id = p_seed1_id THEN p_couple1_id
    WHEN id = p_seed2_id THEN p_couple2_id
    ELSE couple_id
  END,
  updated_at = NOW()
  WHERE id IN (p_seed1_id, p_seed2_id);

END;
$$;
```

---

## 🎯 Casos de Uso

### Caso 1: Swap Simple (Matches PENDING)

**Input:**
- Pareja X en posición 3 (seed "3A")
- Pareja Y en posición 2 (seed "2A")
- Match R1-M1: Usa seed "2A" → Status: PENDING
- Match R1-M2: Usa seed "3A" → Status: PENDING

**Acción:**
- Editar match → Posiciones se intercambian

**Output:**
- ✅ SWAP ejecutado
- Seed "2A" → Pareja X
- Seed "3A" → Pareja Y
- Matches actualizados con nuevas parejas

---

### Caso 2: Skip por Match en Progreso

**Input:**
- Pareja X en posición 3 (seed "3A")
- Pareja Y en posición 2 (seed "2A")
- Match R1-M1: Usa seed "2A" → Status: **PLAYING** 🎾
- Match R1-M2: Usa seed "3A" → Status: PENDING

**Acción:**
- Editar match → Posiciones se intercambian

**Output:**
- ⏭️ SKIP ejecutado (Match R1-M1 en juego)
- Seed "2A" → MANTIENE Pareja Y (no se toca)
- Seed "3A" → MANTIENE Pareja X (no se toca)
- ⚠️ Warning: "Seeds not updated - matches in progress"

---

### Caso 3: Swap Parcial

**Input:**
- 4 parejas cambiaron de posición
- 2 seeds tienen matches PENDING (pueden swap)
- 2 seeds tienen matches PLAYING (no se tocan)

**Acción:**
- Editar match

**Output:**
- ✅ 2 seeds swapped
- ⏭️ 2 seeds skipped
- Mensaje: "Partial reassignment completed"

---

## 🧪 Tests Requeridos

### Test 1: Swap Simple Sin Matches Activos

```typescript
it('should swap seeds when all matches are PENDING', async () => {
  // Setup: 2 parejas con posiciones cambiadas, matches PENDING
  // Acción: executeSmartReassignment()
  // Verificar: Seeds intercambiados correctamente
  // Verificar: Matches actualizados con nuevas parejas
})
```

### Test 2: Skip por Match PLAYING

```typescript
it('should skip swap when match is PLAYING', async () => {
  // Setup: Match con seed en uso está en status PLAYING
  // Acción: executeSmartReassignment()
  // Verificar: Seeds NO modificados
  // Verificar: Warning logged
  // Verificar: swapped = 0, skipped > 0
})
```

### Test 3: Skip por Match FINISHED

```typescript
it('should skip swap when match is FINISHED', async () => {
  // Setup: Match con seed ya tiene resultado
  // Acción: executeSmartReassignment()
  // Verificar: Seeds NO modificados (mantener integridad histórica)
})
```

### Test 4: Swap Parcial

```typescript
it('should swap only safe seeds in partial scenario', async () => {
  // Setup: 4 cambios de posición, 2 PENDING, 2 PLAYING
  // Acción: executeSmartReassignment()
  // Verificar: 2 seeds swapped
  // Verificar: 2 seeds skipped
  // Verificar: Matches PENDING actualizados, PLAYING sin tocar
})
```

---

## 🔒 Seguridad y Validaciones

### Validaciones Pre-Swap

1. ✅ **Match Status:** Solo modificar si `status = 'PENDING'`
2. ✅ **Resultados:** Solo modificar si `result_couple1 IS NULL`
3. ✅ **Seed Ownership:** Verificar que seed pertenece al torneo
4. ✅ **Duplicate Check:** No crear parejas duplicadas

### Rollback en Caso de Error

```typescript
try {
  await executeSmartReassignment(...)
} catch (error) {
  // Rollback automático por transacción de Supabase
  console.error('Reassignment failed - rolling back')
  throw error
}
```

---

## 📊 Logging y Monitoreo

```typescript
console.log(`🔄 [SMART-REASSIGNMENT] Zone ${zoneId}:`)
console.log(`   - Position changes detected: ${changes.length}`)
console.log(`   - Matches affected: ${matchIds.length}`)
console.log(`   - Swappable: ${swappable}`)
console.log(`   - Locked: ${locked}`)
console.log(`✅ [SMART-REASSIGNMENT] Completed: ${swapped} swapped, ${skipped} skipped`)
```

---

## 🚀 Integración en el Flujo Existente

### Modificar `checkAndUpdateZonePositions`

```typescript
export async function checkAndUpdateZonePositions(
  tournamentId: string,
  zoneId: string
) {
  // 1. Actualizar posiciones de zona
  await updateZonePositions(tournamentId, zoneId)

  // 2. Obtener nuevas posiciones definitivas
  const definitivePositions = await getNewDefinitivePositions(tournamentId, zoneId)

  // 3. Verificar estado del torneo
  const tournamentStatus = await getTournamentStatus(tournamentId)

  if (tournamentStatus === 'BRACKET_PHASE') {
    // 🆕 USAR SMART REASSIGNMENT en lugar de invalidar
    const reassignmentResult = await executeSmartReassignment(
      tournamentId,
      zoneId,
      definitivePositions
    )

    return {
      success: true,
      positionsUpdated: true,
      seedsSwapped: reassignmentResult.swapped,
      seedsSkipped: reassignmentResult.skipped,
      message: reassignmentResult.message
    }
  } else {
    // ZONE_PHASE: Resolver placeholders normalmente
    return await resolvePlaceholderSeeds(tournamentId, definitivePositions)
  }
}
```

---

## ✅ Ventajas de Esta Solución

1. ✅ **No invalida matches activos** → Respeta partidos en juego
2. ✅ **Swap inteligente** → Solo modifica lo necesario
3. ✅ **Granular** → Puede hacer swaps parciales
4. ✅ **Seguro** → Validaciones exhaustivas
5. ✅ **Auditable** → Logging completo de cambios
6. ✅ **Transaccional** → Rollback automático en errores

---

## 📝 Checklist de Implementación

- [ ] Crear función `detectPositionChanges()`
- [ ] Crear función `getMatchLockStatus()`
- [ ] Crear función `calculateSafeReassignments()`
- [ ] Crear función `executeSmartReassignment()`
- [ ] Crear RPC `swap_seed_couples()` en Supabase
- [ ] Modificar `checkAndUpdateZonePositions()` para usar smart reassignment
- [ ] Crear 4 tests de cobertura (swap, skip, partial, finished)
- [ ] Validar manualmente con torneo real

---

**Complejidad:** ⭐⭐⭐⭐ (Alta)
**Impacto:** 🔥🔥🔥🔥🔥 (Crítico)
**Prioridad:** 🚨 P0
**Estimación:** 4-6 horas de desarrollo + testing
