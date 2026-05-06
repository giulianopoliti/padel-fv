# 🐛 BUG: Pareja Migrada Dos Veces al Bracket

## 📋 Descripción del Problema

**Severidad:** 🔴 CRÍTICA

Cuando se edita un resultado de match en fase de ZONA después de que el bracket ya está generado, una pareja puede ser migrada **DOS VECES** al bracket, dejando a otra pareja afuera.

### Escenario de Reproducción

1. **Estado Inicial:**
   - Zona A con 4 parejas
   - Matches jugados, posiciones calculadas
   - Pareja X en posición 3 → marcada como definitiva
   - Bracket generado → Pareja X migrada con placeholder "3A"

2. **Acción del Usuario:**
   - Edita un resultado de match en Zona A
   - Las posiciones se recalculan

3. **Nuevo Estado:**
   - Pareja X ahora está en posición 2 → marcada como definitiva
   - Sistema resuelve placeholder "2A" → **Migra Pareja X OTRA VEZ**

4. **Resultado INCORRECTO:**
   - ❌ Pareja X aparece DOS VECES en el bracket (como "2A" y "3A")
   - ❌ Pareja que debería estar en "3A" queda afuera del bracket
   - ❌ Bracket corrupto

---

## 🔍 Análisis del Código

### Ubicación del Bug

**Archivo:** `lib/services/bracket-placeholder-resolver.ts`
**Función:** `resolvePlaceholderSeeds()` (líneas 117-190)

### Código Problemático

```typescript
export async function resolvePlaceholderSeeds(
  tournamentId: string,
  positions: DefinitivePosition[]
): Promise<ResolvedSeed[]> {
  const supabase = await createClientServiceRole()
  const resolvedSeeds: ResolvedSeed[] = []

  for (const position of positions) {
    // Buscar seeds que necesitan esta posición
    const { data: seeds, error: seedsError } = await supabase
      .from('tournament_couple_seeds')
      .select('id, seed, placeholder_label, placeholder_zone_id, placeholder_position, is_placeholder, couple_id')
      .eq('tournament_id', tournamentId)
      .eq('placeholder_zone_id', position.zoneId)
      .eq('placeholder_position', position.position)
      .eq('is_placeholder', true)  // ⚠️ Solo busca placeholders SIN resolver

    // Resolver cada seed encontrado
    for (const seed of seeds) {
      // ❌ PROBLEMA: NO verifica si position.coupleId ya está en el bracket
      const { error: updateError } = await supabase
        .from('tournament_couple_seeds')
        .update({
          couple_id: position.coupleId,  // ⚠️ Puede ser una pareja YA migrada
          is_placeholder: false,
          placeholder_zone_id: null,
          placeholder_position: null,
          placeholder_label: null,
          resolved_at: new Date().toISOString()
        })
        .eq('id', seed.id)
    }
  }
}
```

---

## 🔥 Causa Raíz

### Problema 1: NO se valida si la pareja ya está en el bracket

Cuando se resuelve un placeholder con `position.coupleId`, **NO se verifica** si esa pareja ya tiene otro seed asignado en `tournament_couple_seeds`.

### Problema 2: Flujo de edición no considera seeds existentes

El flujo es:
1. Usuario edita match → `saveMatchResult()`
2. Recalcula posiciones → `updateZonePositions()`
3. Marca nuevas definitivas → `CorrectedDefinitiveAnalyzer`
4. Resuelve placeholders → `resolvePlaceholderSeeds()`
5. **NO REVIERTE seeds antiguos** de la misma pareja

### Problema 3: `is_placeholder = true` solo busca seeds SIN resolver

```typescript
.eq('is_placeholder', true)
```

Esto significa que:
- ✅ Encuentra placeholder "2A" (no resuelto aún)
- ❌ NO encuentra "3A" (ya resuelto con Pareja X)
- ❌ NO hay validación de conflicto

---

## 📊 Diagrama del Bug

```
ESTADO INICIAL (Bracket Generado)
=====================================
Zona A Posiciones:
├─ Posición 1: Pareja W (definitiva)
├─ Posición 2: Pareja Y (definitiva)
├─ Posición 3: Pareja X (definitiva) ← MIGRADA
└─ Posición 4: Pareja Z (definitiva)

tournament_couple_seeds:
├─ Seed 1: "1A" → couple_id = W, is_placeholder = false ✅
├─ Seed 2: "2A" → couple_id = Y, is_placeholder = false ✅
├─ Seed 3: "3A" → couple_id = X, is_placeholder = false ✅
└─ Seed 4: "4A" → couple_id = Z, is_placeholder = false ✅

=====================================
USUARIO EDITA MATCH
=====================================

Nuevo cálculo de posiciones:
├─ Posición 1: Pareja W (definitiva)
├─ Posición 2: Pareja X (definitiva) ← CAMBIÓ! Era posición 3
├─ Posición 3: Pareja Y (definitiva) ← CAMBIÓ! Era posición 2
└─ Posición 4: Pareja Z (definitiva)

=====================================
SISTEMA RESUELVE PLACEHOLDERS
=====================================

resolvePlaceholderSeeds():
1. Busca placeholder para Zona A, Posición 2
   - NO ENCUENTRA (porque seed "2A" ya está resuelto con couple_id = Y)
   - Query: WHERE placeholder_zone_id = 'A' AND placeholder_position = 2 AND is_placeholder = true
   - Resultado: VACÍO

2. Busca placeholder para Zona A, Posición 3
   - NO ENCUENTRA (porque seed "3A" ya está resuelto con couple_id = X)

❌ RESULTADO: Los seeds NO se actualizan porque ya están resueltos

=====================================
PROBLEMA REAL: Seeds desactualizados
=====================================

tournament_couple_seeds DESPUÉS DE EDICIÓN:
├─ Seed 1: "1A" → couple_id = W ✅ CORRECTO
├─ Seed 2: "2A" → couple_id = Y ❌ DEBERÍA SER X
├─ Seed 3: "3A" → couple_id = X ❌ DEBERÍA SER Y
└─ Seed 4: "4A" → couple_id = Z ✅ CORRECTO

matches (bracket):
├─ Match R1-1: couple1_id = W (seed 1), couple2_id = Y (seed 2) ❌ INCORRECTO
├─ Match R1-2: couple1_id = X (seed 3), couple2_id = Z (seed 4) ❌ INCORRECTO
```

---

## ✅ Solución Propuesta

### Opción 1: Re-resolver TODOS los seeds de la zona (RECOMENDADA)

Cuando se edita un match en BRACKET_PHASE, **invalidar y re-resolver TODOS los seeds** de esa zona:

```typescript
export async function resolvePlaceholderSeeds(
  tournamentId: string,
  positions: DefinitivePosition[],
  zoneId: string // ⭐ Nuevo parámetro
): Promise<ResolvedSeed[]> {
  const supabase = await createClientServiceRole()

  // ⭐ PASO 0: Invalidar seeds existentes de esta zona
  console.log(`🔄 [BRACKET-RESOLVER] Invalidating existing seeds for zone ${zoneId}`)

  const { error: invalidateError } = await supabase
    .from('tournament_couple_seeds')
    .update({
      couple_id: null,
      is_placeholder: true,
      resolved_at: null
    })
    .eq('tournament_id', tournamentId)
    .eq('placeholder_zone_id', zoneId)
    .not('placeholder_position', 'is', null) // Solo seeds de esta zona

  if (invalidateError) {
    console.error(`❌ [BRACKET-RESOLVER] Error invalidating seeds:`, invalidateError)
    throw new Error('Failed to invalidate existing seeds')
  }

  // ⭐ PASO 1: Ahora resolver con las nuevas posiciones definitivas
  for (const position of positions) {
    // Query ahora encontrará los seeds porque los re-marcamos como placeholders
    const { data: seeds } = await supabase
      .from('tournament_couple_seeds')
      .select('id, seed, placeholder_label, placeholder_zone_id, placeholder_position, is_placeholder, couple_id')
      .eq('tournament_id', tournamentId)
      .eq('placeholder_zone_id', position.zoneId)
      .eq('placeholder_position', position.position)
      .eq('is_placeholder', true) // Ahora SÍ encuentra porque los invalidamos

    // Actualizar seed con la nueva pareja correcta
    for (const seed of seeds) {
      await supabase
        .from('tournament_couple_seeds')
        .update({
          couple_id: position.coupleId,
          is_placeholder: false,
          resolved_at: new Date().toISOString()
        })
        .eq('id', seed.id)
    }
  }
}
```

### Opción 2: Verificar conflictos antes de resolver

```typescript
// Antes de resolver, verificar si couple_id ya existe en otro seed
const { data: existingSeeds } = await supabase
  .from('tournament_couple_seeds')
  .select('id, seed, couple_id')
  .eq('tournament_id', tournamentId)
  .eq('couple_id', position.coupleId)

if (existingSeeds && existingSeeds.length > 0) {
  console.warn(`⚠️ [BRACKET-RESOLVER] Couple ${position.coupleId} already assigned to seed ${existingSeeds[0].seed}`)

  // Invalidar el seed antiguo
  await supabase
    .from('tournament_couple_seeds')
    .update({
      couple_id: null,
      is_placeholder: true,
      resolved_at: null
    })
    .eq('id', existingSeeds[0].id)
}
```

### Opción 3: Regenerar bracket completo (NUCLEAR)

En casos de edición significativa, regenerar el bracket desde cero:

```typescript
if (isEditingFinishedMatch && tournamentStatus === 'BRACKET_PHASE') {
  console.warn(`⚠️ [BRACKET-RESOLVER] Editing finished match in BRACKET_PHASE - regenerating bracket`)

  // Invalidar TODOS los seeds
  await supabase
    .from('tournament_couple_seeds')
    .update({
      couple_id: null,
      is_placeholder: true,
      resolved_at: null
    })
    .eq('tournament_id', tournamentId)

  // Regenerar bracket completo
  await generateProgressiveBracket(tournamentId)
}
```

---

## 🧪 Tests Requeridos

### Test 1: Detectar doble migración

```typescript
it('should NOT migrate same couple twice when position changes', async () => {
  // Setup: Zona con posiciones definitivas y bracket generado
  // Acción: Editar match que cambia posición de Pareja X de 3 a 2
  // Verificar: Pareja X solo aparece UNA VEZ en tournament_couple_seeds
  // Verificar: Posición anterior (3) ahora tiene nueva pareja correcta
})
```

### Test 2: Validar re-resolución de seeds

```typescript
it('should re-resolve all zone seeds when editing in BRACKET_PHASE', async () => {
  // Setup: Zona con seeds resueltos
  // Acción: Editar match
  // Verificar: TODOS los seeds de la zona se invalidan y re-resuelven
  // Verificar: Seeds finales coinciden con posiciones definitivas actuales
})
```

### Test 3: Prevenir seeds huérfanos

```typescript
it('should not leave orphaned couple_id in old seeds', async () => {
  // Setup: Pareja X en posición 3 (seed resuelto)
  // Acción: Editar match → Pareja X ahora en posición 2
  // Verificar: Seed de posición 3 ya NO tiene couple_id de Pareja X
  // Verificar: Seed de posición 2 SÍ tiene couple_id de Pareja X
})
```

---

## 🚨 Impacto del Bug

### Gravedad: CRÍTICA

- ❌ Bracket corrupto e inválido
- ❌ Parejas duplicadas en playoff
- ❌ Parejas legítimas excluidas del bracket
- ❌ Resultados del torneo incorrectos
- ❌ Pérdida de confianza del usuario

### Frecuencia: ALTA

- Ocurre cada vez que se edita un match después de generar bracket
- Ocurre cuando posiciones definitivas cambian
- Común en torneos activos donde se corrigen errores

---

## 📝 Checklist de Implementación

### Solución Inmediata (Opción 1 - Recomendada)

- [ ] Modificar `resolvePlaceholderSeeds()` para invalidar seeds existentes
- [ ] Agregar parámetro `zoneId` para scope de invalidación
- [ ] Actualizar `resolveZonePlaceholders()` para pasar `zoneId`
- [ ] Crear tests de regresión (3 tests mínimo)
- [ ] Validar con scenario de reproducción manual

### Validación Adicional

- [ ] Agregar logging detallado de invalidación de seeds
- [ ] Crear alerta cuando se detecta pareja duplicada
- [ ] Agregar constraint único en DB para prevenir duplicados
- [ ] Documentar comportamiento esperado en edición de matches

---

## 🔗 Archivos Afectados

1. `lib/services/bracket-placeholder-resolver.ts` - **MODIFICAR**
   - Función `resolvePlaceholderSeeds()` (línea 117)
   - Función `resolveZonePlaceholders()` (línea 445)

2. `app/api/tournaments/[id]/actions.ts`
   - Función `checkAndUpdateZonePositions()` (línea 2622)
   - Validar que pase `zoneId` correctamente

3. **CREAR:** `lib/services/__tests__/bracket-editing-bug.test.ts`
   - Tests de reproducción del bug
   - Tests de prevención de doble migración

---

**Fecha de Identificación:** 2025-01-27
**Reportado Por:** Usuario
**Prioridad:** 🔴 P0 - CRÍTICA
**Estado:** 🔍 IDENTIFICADO - Pendiente de Fix
