# `saveMatchResult` - Documentación Técnica

## 📍 Ubicación
**Archivo:** [`app/api/tournaments/[id]/actions.ts`](../app/api/tournaments/[id]/actions.ts#L1367-L1443)

## 📋 Descripción General

`saveMatchResult` es la función principal para guardar o actualizar resultados de partidos en torneos americanos. Esta función no solo persiste el resultado del match en la base de datos, sino que también **recalcula automáticamente las posiciones de zona, actualiza rankings, y puede avanzar brackets eliminatorios**.

## 🔧 Signatura

```typescript
export async function saveMatchResult(
  tournamentId: string,
  matchId: string,
  couple1Score: number,
  couple2Score: number,
  couple1Id: string,
  couple2Id: string
): Promise<ApiResponse>
```

### Parámetros

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `tournamentId` | `string` | ID del torneo |
| `matchId` | `string` | ID del match a actualizar |
| `couple1Score` | `number` | Score de la primera pareja (según el dialog) |
| `couple2Score` | `number` | Score de la segunda pareja (según el dialog) |
| `couple1Id` | `string` | ID de la primera pareja (según el dialog) |
| `couple2Id` | `string` | ID de la segunda pareja (según el dialog) |

**⚠️ IMPORTANTE:** El orden de `couple1` y `couple2` puede no coincidir con el orden en la base de datos. La función maneja esta discrepancia internamente.

## 🔄 Flujo de Ejecución Completo

### **PASO 1: Autenticación y Permisos**
```typescript
// Validar usuario autenticado
const { data: { user }, error: userErr } = await supabase.auth.getUser()

// Verificar permisos (CLUB + ORGANIZADOR + ADMIN)
const permissions = await checkTournamentPermissions(user.id, tournamentId)
```

**Qué hace:**
- Verifica que haya un usuario autenticado en la sesión
- Llama a `checkTournamentPermissions` para verificar si el usuario:
  - Es propietario del club (`club_id` en tabla `tournaments` coincide con `profile.club_id`)
  - Es organizador del torneo (tabla `tournament_organizers`)
  - Es admin del sistema (`profile.role = 'admin'`)
- **Si no tiene permisos:** Rechaza la operación con error 403

---

### **PASO 2: Obtener Match de Base de Datos**
```typescript
const { data: matchRow, error: matchErr } = await supabase
  .from("matches")
  .select("id, status, couple1_id, couple2_id")
  .eq("id", matchId)
  .eq("tournament_id", tournamentId)
  .single()
```

**Qué hace:**
- Busca el match en la tabla `matches`
- **CRÍTICO:** Obtiene `couple1_id` y `couple2_id` para saber el orden correcto en DB
- Obtiene `status` para detectar si estamos editando un match ya finalizado
- Valida que el match pertenezca al torneo correcto (seguridad)

---

### **PASO 3: Validaciones Básicas**
```typescript
const isEditingFinishedMatch = matchRow.status === 'FINISHED'
if (couple1Score < 0 || couple2Score < 0) return { error: "Scores must be positive" }
if (couple1Score === couple2Score) return { error: "Scores must be different" }
```

**Validaciones:**
- ✅ Detecta si estamos editando un match ya finalizado (para notificar al usuario)
- ✅ Scores deben ser positivos (no negativos)
- ✅ Scores deben ser diferentes (no puede haber empate en pádel)

---

### **PASO 4: ✅ CORRECCIÓN - Determinar Orden Correcto de Scores**

**PROBLEMA RESUELTO:**
El dialog puede abrir con `couple1` y `couple2` en cualquier orden según la fila/columna de la matriz donde se hizo clic. Sin embargo, la base de datos tiene un orden fijo (`couple1_id`, `couple2_id`). Esta sección garantiza que los scores se guarden en el orden correcto.

```typescript
// ✅ CORRECCIÓN: Determinar qué score corresponde a qué pareja en DB
let dbCouple1Score: number;
let dbCouple2Score: number;

if (couple1Id === matchRow.couple1_id) {
  // Orden correcto: couple1 del dialog = couple1 de DB
  dbCouple1Score = couple1Score;
  dbCouple2Score = couple2Score;
} else if (couple1Id === matchRow.couple2_id) {
  // Orden invertido: couple1 del dialog = couple2 de DB
  dbCouple1Score = couple2Score;
  dbCouple2Score = couple1Score;
} else {
  return { error: "Couple IDs do not match the match record" }
}
```

**Lógica:**
1. Compara `couple1Id` (del dialog) con `matchRow.couple1_id` (de DB)
2. **Si coinciden:** Usa los scores tal como vienen del dialog
3. **Si NO coinciden:** **INTERCAMBIA** los scores para que correspondan al orden de la DB
4. **Si ninguno coincide:** Error de seguridad (los IDs no pertenecen a este match)

**Ejemplo:**
- **DB:** `couple1_id = "ABC"`, `couple2_id = "XYZ"`
- **Dialog abre desde fila 2 (pareja XYZ):** `couple1Id = "XYZ"`, `couple2Id = "ABC"`, scores: 6-1
- **Corrección:** Detecta que `couple1Id` NO coincide con `couple1_id`, entonces intercambia:
  - `dbCouple1Score = 1` (porque ABC perdió)
  - `dbCouple2Score = 6` (porque XYZ ganó)

---

### **PASO 5: Calcular Ganador y Actualizar Match**
```typescript
// ✅ Calcular ganador según los scores correctos de DB
const winnerId = dbCouple1Score > dbCouple2Score ? matchRow.couple1_id : matchRow.couple2_id;

const {data: matchUpdate} = await supabase
  .from("matches")
  .update({
    winner_id: winnerId,
    result_couple1: dbCouple1Score,
    result_couple2: dbCouple2Score,
    status: 'FINISHED',
  })
  .eq("id", matchId)
  .eq("tournament_id", tournamentId)
```

**Qué hace:**
- Calcula `winnerId` comparando los scores **corregidos** de DB
- Actualiza el match en la tabla `matches` con:
  - `winner_id`: ID de la pareja ganadora (según orden de DB)
  - `result_couple1`: Score de `couple1` **según la DB**
  - `result_couple2`: Score de `couple2` **según la DB**
  - `status`: `FINISHED` (marca el match como completado)

---

### **PASO 6: Obtener Zone ID del Match**
```typescript
const { data: matchWithZone } = await supabase
  .from("matches")
  .select("zone_id")
  .eq("id", matchId)
  .single()
```

**Qué hace:**
- Obtiene el `zone_id` del match
- Necesario para recalcular las posiciones de esa zona específica

---

### **PASO 7: 🔥 Actualizar Posiciones de Zona**

```typescript
if (!zoneErr && matchWithZone?.zone_id) {
  const positionUpdate = await checkAndUpdateZonePositions(tournamentId, matchWithZone.zone_id)

  return {
    success: true,
    match: matchUpdate,
    isEditingFinishedMatch,
    positionUpdate: {
      positionsUpdated: positionUpdate.positionsUpdated,
      bracketAdvanced: positionUpdate.bracketAdvanced,
      placeholdersResolved: positionUpdate.placeholdersResolved,
      message: positionUpdate.message
    }
  }
}
```

**Qué hace:**
Llama a **`checkAndUpdateZonePositions`** que ejecuta el siguiente flujo:

#### **7.1. `updateZonePositions(tournamentId, zoneId)`**

Esta sub-función recalcula todas las posiciones de la zona:

1. **Obtiene parejas de la zona** desde `zone_couples` con detalles de jugadores
2. **Obtiene matches finalizados** de la zona desde `matches` WHERE `zone_id` y `status = 'FINISHED'`
3. **Calcula estadísticas** usando `ZoneStatsCalculator`:
   - Puntos (victorias/derrotas)
   - Games ganados/perdidos
   - Game difference
   - Head-to-head matrix (enfrentamientos directos)
4. **Rankea parejas** usando `ZoneRankingEngine` aplicando criterios en orden:
   - **1°** Puntos (wins)
   - **2°** Game difference (+/-)
   - **3°** Games ganados
   - **4°** Head-to-head (si hay empate entre 2 parejas)
   - **5°** Player score total (suma de scores de jugadores)
5. **Determina posiciones definitivas** usando `CorrectedDefinitiveAnalyzer`:
   - Analiza si una posición ya no puede cambiar matemáticamente
   - Marca `is_definitive = true` cuando corresponda
6. **Guarda en DB** tabla `zone_positions`:
   - `position`: 1, 2, 3, 4...
   - `is_definitive`: true/false
   - `points`, `wins`, `losses`, `games_for`, `games_against`, `games_difference`
   - `player_score_total`, `tie_info`, `calculated_at`

#### **7.2. Verificar Estado del Torneo**

```typescript
const { data: tournament } = await supabase
  .from('tournaments')
  .select('status')
  .eq('id', tournamentId)
  .single()

const tournamentStatus = tournament?.status || 'ZONE_PHASE'
```

**Estados posibles:**
- `ZONE_PHASE`: Torneo en fase de zonas, no hay bracket aún
- `BRACKET_PHASE`: Torneo en fase eliminatoria, hay bracket generado

#### **7.3. Resolver Placeholders (Solo si `BRACKET_PHASE`)**

```typescript
if (tournamentStatus === 'BRACKET_PHASE') {
  const bracketResolver = getBracketPlaceholderResolver()
  const bracketResult = await bracketResolver.resolveZonePlaceholders(tournamentId, zoneId)
}
```

**Qué hace:**
- Solo se ejecuta si el torneo ya pasó a fase de bracket
- Resuelve "placeholders" en el bracket eliminatorio
- **Ejemplo:** Si Pareja X quedó 1° en Zona A:
  - Busca en el bracket el placeholder "1A"
  - Lo reemplaza con el ID real de Pareja X
  - Actualiza tabla `tournament_couple_seeds`

#### **7.4. Intentar Avanzar Bracket**

```typescript
if (shouldAttemptBracketAdvancement) {
  const advancementCheck = await canAdvanceBracket(tournamentId)

  if (advancementCheck.canAdvance) {
    const bracketResult = await generateProgressiveBracket(tournamentId)
  }
}
```

**Qué hace:**
- Verifica si hay suficientes posiciones definitivas para generar/actualizar brackets
- **Mínimo requerido:** 4 parejas con posiciones definitivas
- Genera o actualiza el bracket eliminatorio
- **Casos de uso:**
  - Primera generación: Cuando todas las zonas tienen posiciones definitivas
  - Actualización: Cuando cambia una posición definitiva (edición de resultado)

---

## 📊 Diagrama de Flujo

```
┌─────────────────────────────────────────┐
│ 1. Autenticación + Permisos             │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│ 2. Obtener Match (con couple1_id/2_id)  │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│ 3. Validar Scores (>0, diferentes)      │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│ 4. CORRECCIÓN: Determinar orden correcto│
│    - Comparar couple1Id con DB          │
│    - Intercambiar scores si es necesario│
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│ 5. Actualizar Match en DB               │
│    - winner_id                          │
│    - result_couple1/2 (orden DB)        │
│    - status = FINISHED                  │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│ 6. Obtener zone_id del Match            │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│ 7. checkAndUpdateZonePositions          │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ 7.1. updateZonePositions         │  │
│  │   - Obtener couples + matches    │  │
│  │   - Calcular stats (ZoneStats)   │  │
│  │   - Rankear (ZoneRanking)        │  │
│  │   - Marcar definitivas (Analyzer)│  │
│  │   - Guardar en zone_positions    │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ 7.2. Verificar Estado Torneo     │  │
│  │   - ZONE_PHASE / BRACKET_PHASE   │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ 7.3. Resolver Placeholders       │  │
│  │   (Solo si BRACKET_PHASE)        │  │
│  │   - "1A" → Pareja X (real)       │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ 7.4. Avanzar Bracket             │  │
│  │   (Si hay suficientes definitivas)│  │
│  │   - generateProgressiveBracket   │  │
│  └──────────────────────────────────┘  │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│ 8. Return Success + Position Update Info│
│    - positionsUpdated: boolean          │
│    - bracketAdvanced: boolean           │
│    - placeholdersResolved: number       │
└─────────────────────────────────────────┘
```

---

## 🎯 Responsabilidades Clave

### ✅ Lo que SÍ hace:
1. **Guardar resultado del match** con scores correctos (orden DB)
2. **Calcular ganador** y actualizar `winner_id`
3. **Recalcular TODAS las posiciones de la zona** afectada
4. **Determinar posiciones definitivas** (que ya no pueden cambiar)
5. **Resolver placeholders** en brackets (si corresponde)
6. **Avanzar brackets** automáticamente cuando sea posible
7. **Manejar edición de matches finalizados** (re-ranking completo)

### ❌ Lo que NO hace:
- No valida reglas de pádel (eso lo hace el dialog en frontend)
- No crea nuevos matches (eso es `createMatchOfZone`)
- No elimina matches (eso es `deleteMatch`)
- No modifica zonas (eso es API `/zones`)

---

## 🔒 Seguridad y Validaciones

### Validaciones de Autenticación:
- ✅ Usuario autenticado requerido
- ✅ Permisos verificados (club owner, organizer, o admin)

### Validaciones de Datos:
- ✅ Match existe y pertenece al torneo
- ✅ Scores positivos y diferentes
- ✅ Couple IDs pertenecen al match
- ✅ Orden de scores corregido automáticamente

### Validaciones de Integridad:
- ✅ Transacciones atómicas (match update + position update)
- ✅ Manejo de errores graceful (si falla position update, match ya está guardado)
- ✅ Rollback automático si falla la actualización del match

---

## 📈 Casos de Uso

### Caso 1: Cargar Resultado Primera Vez
```
Match: PENDING → FINISHED
Zona: Posiciones recalculadas
Bracket: No afecta (ZONE_PHASE)
```

### Caso 2: Editar Resultado Existente
```
Match: FINISHED (6-1) → FINISHED (6-2)
Zona: Posiciones recalculadas (pueden cambiar!)
Bracket: Placeholders re-resueltos si cambió una definitiva
```

### Caso 3: Último Resultado de Zona (Torneo en BRACKET_PHASE)
```
Match: PENDING → FINISHED
Zona: Todas las posiciones ahora definitivas
Bracket: Placeholder "1A" resuelto → Pareja X
         Auto-avance si todas las zonas están completas
```

---

## 🐛 Corrección Implementada (Bug Fix)

### Problema Original:
Los scores se guardaban invertidos cuando el dialog se abría desde diferentes celdas de la matriz.

### Causa:
La función asumía que `couple1` del dialog siempre coincidía con `couple1_id` de la DB, pero esto no era cierto.

### Solución (líneas 1397-1413):
```typescript
// Comparar couple IDs y corregir orden de scores
if (couple1Id === matchRow.couple1_id) {
  dbCouple1Score = couple1Score;
  dbCouple2Score = couple2Score;
} else if (couple1Id === matchRow.couple2_id) {
  dbCouple1Score = couple2Score;  // ✅ INTERCAMBIADO
  dbCouple2Score = couple1Score;  // ✅ INTERCAMBIADO
}
```

---

## 📚 Funciones Relacionadas

| Función | Descripción |
|---------|-------------|
| `checkAndUpdateZonePositions` | Orquesta actualización de posiciones y bracket |
| `updateZonePositions` | Calcula y guarda rankings de zona |
| `checkTournamentPermissions` | Verifica permisos del usuario |
| `createMatchOfZone` | Crea un nuevo match (POST) |
| `deleteMatch` | Elimina un match (DELETE) |
| `ZoneStatsCalculator` | Calcula estadísticas de parejas |
| `ZoneRankingEngine` | Rankea parejas según criterios |
| `CorrectedDefinitiveAnalyzer` | Determina posiciones definitivas |
| `getBracketPlaceholderResolver` | Resuelve placeholders en brackets |
| `generateProgressiveBracket` | Genera/actualiza bracket eliminatorio |

---

## 🔗 Endpoints que la Invocan

### API Route: `PATCH /api/tournaments/[id]`
**Archivo:** [`app/api/tournaments/[id]/route.ts`](../app/api/tournaments/[id]/route.ts#L154-L196)

```typescript
export async function PATCH(request: Request, { params }) {
  const { matchId, couple1Score, couple2Score, couple1Id, couple2Id } = await request.json()
  const result = await saveMatchResult(tournamentId, matchId, couple1Score, couple2Score, couple1Id, couple2Id)
  return NextResponse.json(result)
}
```

### Componente UI: `ZoneMatchDialog`
**Archivo:** [`components/tournament/zones/components/ZoneMatchDialog.tsx`](../components/tournament/zones/components/ZoneMatchDialog.tsx#L196-L263)

```typescript
const handleSaveResult = async () => {
  const response = await fetch(`/api/tournaments/${tournamentId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      matchId: existingMatch.id,
      couple1Score: score1,
      couple2Score: score2,
      couple1Id: couple1.id,
      couple2Id: couple2.id
    })
  })
}
```

---

## 📝 Notas de Desarrollo

### Performance:
- **Optimización:** Usa `createClientServiceRole()` para updates masivos (bypass RLS)
- **Transaccional:** Position updates son independientes de match update (resiliente a fallos)
- **Caching:** No tiene cache (siempre recalcula - puede optimizarse en el futuro)

### Testing:
- **Test manual recomendado:** Cargar resultado desde fila A vs B, y desde fila B vs A
- **Verificar:** Que los scores en DB sean consistentes independiente de la celda clickeada
- **Verificar:** Que las posiciones se recalculen correctamente después de cada resultado

---

## ✅ Checklist de Funcionalidad

- [x] Autentica usuario
- [x] Verifica permisos
- [x] Valida scores básicos
- [x] Corrige orden de scores automáticamente
- [x] Calcula ganador correctamente
- [x] Actualiza match en DB
- [x] Recalcula posiciones de zona
- [x] Determina posiciones definitivas
- [x] Resuelve placeholders (BRACKET_PHASE)
- [x] Avanza bracket cuando corresponde
- [x] Maneja errores gracefully
- [x] Devuelve información completa de resultado

---

**Fecha de última actualización:** 2025-01-27
**Versión:** 2.0 (con corrección de orden de scores)
