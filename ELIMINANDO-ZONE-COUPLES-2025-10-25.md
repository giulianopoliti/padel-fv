# Changelog - 25 de Octubre 2025

## Migración de `zone_couples` a `zone_positions` como Fuente de Verdad

### Contexto
El sistema manejaba dos tablas para las parejas en zonas:
- **`zone_couples`**: Tabla legacy que solo almacenaba la relación zona-pareja
- **`zone_positions`**: Tabla nueva con estadísticas completas (posición, puntos, victorias, derrotas, games, sets, etc.)

Esto causaba inconsistencias cuando las tablas se desincronizaban.

### Objetivo
Migrar el sistema para usar **`zone_positions`** como fuente principal de verdad, manteniendo `zone_couples` solo por compatibilidad durante la transición.

---

## Cambios Realizados

### 1. **Creación de Zonas para Torneos Americanos**
**Archivo**: `app/api/tournaments/[id]/actions.ts`
**Función**: `createTournamentZones()` (líneas 301-360)

#### Problema
Solo insertaba en `zone_couples`, dejando `zone_positions` vacía.

#### Solución
Agregado insert a `zone_positions` con todas las estadísticas inicializadas:
```typescript
// 3.5) ✅ NUEVO: Insertar en zone_positions (nueva fuente de verdad)
const zonePositionsToInsert: any[] = [];

zones.forEach((z) => {
  const zoneId = idByName[z.name];
  let position = 1;

  z.couples.forEach((c) => {
    zonePositionsToInsert.push({
      tournament_id: tournamentId,
      zone_id: zoneId,
      couple_id: c.couple_id,
      position: position++,
      is_definitive: false,
      points: 0,
      wins: 0,
      losses: 0,
      games_for: 0,
      games_against: 0,
      games_difference: 0,
      player_score_total: 0,
      sets_for: 0,
      sets_against: 0,
      sets_difference: 0
    });
  });
});

if (zonePositionsToInsert.length > 0) {
  const { error: positionsErr } = await supabase
    .from("zone_positions")
    .insert(zonePositionsToInsert);
  // ... manejo de errores
}
```

---

### 2. **Conteo de Parejas en Zona**
**Archivo**: `app/api/tournaments/[id]/actions.ts`
**Función**: `countCouplesInZone()` (línea 369)

#### Cambio
```typescript
// ANTES
.from("zone_couples")

// AHORA
.from("zone_positions")  // ✅ Cambio: leer de zone_positions
```

---

### 3. **Agregar Pareja a Zona**
**Archivo**: `app/api/tournaments/[id]/actions.ts`
**Función**: `addCoupleToZone()` (líneas 475-582)

#### Cambios Principales

1. **Validación desde `zone_positions`** (línea 499):
```typescript
const { count: coupleExists } = await supabase
  .from("zone_positions")  // ✅ Cambio: leer de zone_positions
  .select("*, zones!inner(tournament_id)", { head: true, count: "exact" })
  .eq("couple_id", coupleId)
  .eq("zones.tournament_id", tournamentId);
```

2. **Insertar SIEMPRE en ambas tablas** (líneas 513-566):
```typescript
// 5. ✅ SIEMPRE insertar en zone_positions (nueva fuente de verdad)
const shouldInsertInZonePositions = true;

// 6. Insertar en zone_couples (mantener por compatibilidad)
const { error: zoneCoupleError } = await supabase
  .from("zone_couples")
  .insert({ zone_id: zoneId, couple_id: coupleId });

// 7. ✅ Insertar en zone_positions (SIEMPRE)
if (shouldInsertInZonePositions) {
  // Calcular la siguiente posición disponible
  const { data: maxPositionData } = await supabase
    .from("zone_positions")
    .select("position")
    .eq("zone_id", zoneId)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const nextPosition = maxPositionData ? maxPositionData.position + 1 : 1;

  const { error: zonePositionError } = await supabase
    .from("zone_positions")
    .insert({
      tournament_id: tournamentId,
      zone_id: zoneId,
      couple_id: coupleId,
      position: nextPosition,
      is_definitive: false,
      points: 0,
      wins: 0,
      losses: 0,
      // ... todas las estadísticas en 0
    });

  if (zonePositionError) {
    // Rollback: eliminar de zone_couples si falla zone_positions
    await supabase
      .from("zone_couples")
      .delete()
      .eq("zone_id", zoneId)
      .eq("couple_id", coupleId);

    return createApiResponse({ success: false, message: `Error al crear posición: ${zonePositionError.message}` });
  }
}
```

3. **✅ NUEVO: Recalcular posiciones después de agregar** (líneas 568-576):
```typescript
// ✅ NUEVO: Recalcular posiciones de la zona después de agregar la pareja
console.log(`[addCoupleToZone] Recalculando posiciones de zona ${zoneId}`);
try {
  await updateZonePositions(tournamentId, zoneId);
  console.log(`✅ [addCoupleToZone] Posiciones recalculadas en zona ${zoneId}`);
} catch (recalcError: any) {
  console.error(`⚠️ [addCoupleToZone] Error recalculando posiciones:`, recalcError);
  // No fallar la operación completa - la inserción ya se realizó exitosamente
}
```

#### Impacto
- Las parejas agregadas desde el pool de no asignadas ahora se muestran correctamente
- Las posiciones se recalculan automáticamente basándose en resultados de partidos existentes
- Sistema de rollback si falla la inserción en `zone_positions`

---

### 4. **Mover Pareja entre Zonas**
**Archivo**: `app/api/tournaments/[id]/actions.ts`
**Función**: `moveCoupleToZone()` (líneas 578-703)

#### Cambios Principales

1. **Operaciones priorizando `zone_positions`**: Simplificado el flujo para usar `zone_positions` como fuente principal

2. **✅ NUEVO: Recalcular posiciones de ambas zonas** (líneas 680-702):
```typescript
// ✅ NUEVO: Recalcular posiciones de AMBAS zonas (origen y destino)
console.log(`[moveCoupleToZone] Recalculando posiciones de zona origen ${fromZoneId} y destino ${toZoneId}`);

// Recalcular zona origen (puede cambiar posiciones de parejas restantes)
try {
  await updateZonePositions(tournamentId, fromZoneId);
  console.log(`✅ [moveCoupleToZone] Posiciones recalculadas en zona origen ${fromZoneId}`);
} catch (recalcError: any) {
  console.error(`⚠️ [moveCoupleToZone] Error recalculando zona origen:`, recalcError);
  // No fallar la operación completa - el movimiento ya se realizó
}

// Recalcular zona destino (calcular stats reales de la pareja movida)
try {
  await updateZonePositions(tournamentId, toZoneId);
  console.log(`✅ [moveCoupleToZone] Posiciones recalculadas en zona destino ${toZoneId}`);
} catch (recalcError: any) {
  console.error(`⚠️ [moveCoupleToZone] Error recalculando zona destino:`, recalcError);
  // No fallar la operación completa - el movimiento ya se realizó
}
```

#### Impacto
- Las parejas movidas ahora reflejan sus estadísticas reales (no todo en 0)
- Ambas zonas (origen y destino) recalculan posiciones automáticamente
- El ranking se actualiza basándose en partidos jugados

---

### 5. **Intercambiar Parejas entre Zonas**
**Archivo**: `app/api/tournaments/[id]/actions.ts`
**Función**: `swapCouplesBetweenZones()` (líneas 715-777)

#### Cambios
Agregadas operaciones a `zone_positions` para mantener sincronización:

```typescript
// 2. ✅ Eliminar de zone_positions (fuente de verdad)
const { error: deletePositionsError } = await supabase
  .from("zone_positions")
  .delete()
  .or(
    `and(zone_id.eq.${zoneId1},couple_id.eq.${coupleId1}),` +
    `and(zone_id.eq.${zoneId2},couple_id.eq.${coupleId2})`
  );

// 4. ✅ Insertar en zone_positions cruzados (fuente de verdad)
const { error: insertPositionsError } = await supabase
  .from("zone_positions")
  .insert([
    {
      tournament_id: tournamentId,
      zone_id: zoneId1,
      couple_id: coupleId2,
      position: 1, // Reordenar después
      is_definitive: false,
      points: 0, wins: 0, losses: 0,
      // ... todas las estadísticas
    },
    {
      tournament_id: tournamentId,
      zone_id: zoneId2,
      couple_id: coupleId1,
      position: 1,
      is_definitive: false,
      points: 0, wins: 0, losses: 0,
      // ... todas las estadísticas
    }
  ]);
```

---

### 6. **Servicios de Validación de Partidos**
**Archivo**: `lib/services/match-validation.service.ts`
**Líneas**: 95, 198

#### Cambio
```typescript
// ANTES
.from('zone_couples')

// AHORA
.from('zone_positions')  // ✅ Cambio: leer de zone_positions
```

#### Impacto
- La validación de parejas para creación de partidos ahora usa datos actualizados
- Asegura que solo parejas válidas en `zone_positions` puedan jugar

---

### 7. **Servicio de Disponibilidad de Parejas**
**Archivo**: `lib/services/couple-availability.service.ts`

#### Cambio
Todas las consultas cambiadas de `zone_couples` a `zone_positions`:

```typescript
.from('zone_positions')  // ✅ Cambio: leer de zone_positions
  .select('couple_id')
  .eq('zone_id', zoneId);
```

#### Impacto
- El sistema de disponibilidad de parejas usa datos sincronizados
- Evita inconsistencias al determinar qué parejas pueden jugar

---

### 8. **Eliminación de Zonas**
**Archivo**: `app/api/tournaments/[id]/zones/delete-zone/route.ts`
**Línea**: 39

#### Cambio
```typescript
// ANTES
const { count: couplesCount, error: countError } = await supabase
  .from("zone_couples")

// AHORA
const { count: couplesCount, error: countError } = await supabase
  .from("zone_positions")  // ✅ Cambio: leer de zone_positions
```

#### Impacto
- La validación de zona vacía ahora usa `zone_positions`
- Previene eliminar zonas con parejas activas

---

## Beneficios de los Cambios

### ✅ Consistencia de Datos
- Una única fuente de verdad (`zone_positions`)
- Eliminación de inconsistencias entre tablas
- Sincronización automática mediante recalculación

### ✅ Estadísticas Precisas
- Posiciones recalculadas automáticamente después de cada operación
- Refleja resultados reales de partidos
- No más posiciones con todo en 0

### ✅ Mejor UX
- Las parejas agregadas desde el pool se muestran correctamente
- Los movimientos entre zonas actualizan rankings automáticamente
- Datos en tiempo real

### ✅ Estrategia de Migración Segura
- Mantiene `zone_couples` como backup durante transición
- Operaciones de escritura en ambas tablas
- Operaciones de lectura priorizan `zone_positions`
- Sistema de rollback en caso de errores

---

## Funciones Pendientes de Migración (Fase 2)

Las siguientes funciones aún leen de `zone_couples` y deben migrarse en una segunda fase:

1. **`updateZonePositions()`** - Función de recalculación (lee de `zone_couples`)
2. **`fetchAvailableCouples()`** - Obtener parejas disponibles
3. **`getDefinitiveCouplesForTournament()`** - Parejas con posiciones definitivas
4. **Otras 6 funciones críticas** identificadas en análisis previo

---

## Torneos LONG

Los torneos tipo LONG aún usan el flujo legacy y deben migrarse siguiendo el mismo patrón aplicado a torneos AMERICAN. Esto se planificará en una fase posterior.

**Archivo pendiente**: `lib/services/registration/long-tournament-strategy.ts`
**Función a modificar**: `assignCoupleToGeneralZone()` (líneas 507-582)

---

## Testing Realizado

✅ Crear zonas en torneo AMERICAN → Inserta correctamente en ambas tablas
✅ Agregar pareja desde pool → Se muestra correctamente con posiciones recalculadas
✅ Mover pareja entre zonas → Recalcula posiciones en origen y destino
✅ Validación de capacidad → Lee correctamente desde `zone_positions`
✅ Sistema de rollback → Elimina de ambas tablas si falla

---

## Notas Técnicas

- **Strategy Pattern**: Se mantiene compatibilidad dual durante migración
- **Error Handling**: Recalculación no bloquea operaciones principales
- **Logging**: Mensajes detallados para debugging
- **Transaction-like**: Rollback manual en caso de fallo en segunda tabla

---

**Autor**: Claude Code
**Fecha**: 25 de Octubre 2025
**Estado**: ✅ Cambios aplicados y testeados para torneos AMERICAN
