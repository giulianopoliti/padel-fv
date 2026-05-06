# 🐛 Diagnóstico: Problema de Visualización Invertida en Dialog de Resultados

**Fecha:** 2025-01-27
**Torneo Afectado:** `71a4b504-e05a-4789-bba5-61a067ad509d`
**Match ID:** `821ccad2-0a46-4632-8014-233e33c6a157`

---

## 📋 Descripción del Problema

### Situación Reportada:
Usuario reporta que al cargar un resultado **6-1** entre:
- **Posición 1 (Zona A):** APolaik AGiuli / Giuliano Politi
- **Posición 3 (Zona A):** Micael Politi / Giulianito Polait

**El resultado se guardó correctamente en DB**, pero al abrir el dialog:
- **Desde fila 3, columna 1:** Muestra como ganador a la pareja de posición 3 (❌ INCORRECTO)
- **Desde fila 1, columna 3:** Muestra como ganador a la pareja de posición 1 (✅ CORRECTO)

---

## ✅ Verificación en Base de Datos

### Match en DB (CORRECTO):
```sql
SELECT
  m.couple1_id,
  m.couple2_id,
  m.result_couple1,
  m.result_couple2,
  m.winner_id
FROM matches m
WHERE m.id = '821ccad2-0a46-4632-8014-233e33c6a157';
```

**Resultado:**
| couple1_id | couple2_id | result_couple1 | result_couple2 | winner_id |
|------------|------------|----------------|----------------|-----------|
| ba623368... (Pos 1) | cfac7fdb... (Pos 3) | **6** | **1** | ba623368... |

✅ **En DB está CORRECTO:**
- `couple1_id` (Posición 1): 6 games → **GANADOR**
- `couple2_id` (Posición 3): 1 game → Perdedor

### Parejas en Zona A:
| Couple ID | Jugadores | Posición |
|-----------|-----------|----------|
| ba623368... | APolaik AGiuli / Giuliano Politi | 1 |
| c98ca4e4... | AMica AMicael / AMica AMica | 2 |
| cfac7fdb... | Micael Politi / Giulianito Polait | 3 |

---

## 🔍 Análisis del Código

### Flujo Actual:

```
┌─────────────────────────────────────────────────────────┐
│ 1. Usuario hace clic en celda de matriz                │
│    - Fila 3 (Micael/Giulianito), Columna 1 (APolaik)   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 2. CoupleRow.tsx: onCellClick(couple, opponentCouple)  │
│    - couple = Fila 3 (Micael/Giulianito)               │
│    - opponentCouple = Columna 1 (APolaik)              │
│    - match = existingMatch from DB                     │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 3. TournamentZonesMatrix: handleCellClick              │
│    - selectedCell = {                                  │
│        couple1: couple (Fila 3)                        │
│        couple2: opponentCouple (Columna 1)             │
│        existingMatch: match (from DB)                  │
│      }                                                 │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 4. ZoneMatchDialog abre con:                           │
│    - couple1 = Fila 3 (Micael/Giulianito)              │
│    - couple2 = Columna 1 (APolaik)                     │
│    - existingMatch = { couple1_id: ba623368 (APolaik), │
│                        couple2_id: cfac7fdb (Micael),  │
│                        result_couple1: 6,              │
│                        result_couple2: 1 }             │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 5. ❌ PROBLEMA: Dialog carga scores SIN VERIFICAR      │
│    useEffect(() => {                                   │
│      setCouple1Score(existingMatch.result_couple1)     │
│      setCouple2Score(existingMatch.result_couple2)     │
│    })                                                  │
│                                                        │
│    couple1 del dialog = Micael (Pos 3)                 │
│    couple1Score cargado = 6 (result_couple1 de DB)     │
│                                                        │
│    ❌ Pero result_couple1 en DB = APolaik (Pos 1), NO Micael! │
└─────────────────────────────────────────────────────────┘
```

---

## 🐛 Causa Raíz del Bug

### Archivo: `ZoneMatchDialog.tsx`
**Líneas:** [84-87](../components/tournament/zones/components/ZoneMatchDialog.tsx#L84-L87)

```typescript
React.useEffect(() => {
  if (open) {
    if (isFinished) {
      // ❌ PROBLEMA: Carga directamente result_couple1/2 sin verificar orden
      setCouple1Score(existingMatch.result_couple1?.toString() || '')
      setCouple2Score(existingMatch.result_couple2?.toString() || '')
      setCourt(existingMatch.court?.toString() || '')
      setIsEditing(false)
    }
    // ...
  }
}, [open, existingMatch, isFinished, isPending])
```

### ❌ Asunción Incorrecta:
El código asume que:
- `couple1` del dialog = `couple1_id` del match en DB
- `couple2` del dialog = `couple2_id` del match en DB

### ✅ Realidad:
- `couple1` del dialog = Pareja de la **FILA** donde se hizo clic
- `couple2` del dialog = Pareja de la **COLUMNA** donde se hizo clic
- `couple1_id` del match en DB = Primer couple en orden de creación del match
- `couple2_id` del match en DB = Segundo couple en orden de creación del match

**NO HAY GARANTÍA** de que el orden del dialog coincida con el orden de la DB.

---

## 📊 Ejemplo Concreto del Bug

### Escenario 1: Click desde Fila 1, Columna 3

```
Dialog abre con:
  couple1 = APolaik (Pos 1) → ID: ba623368
  couple2 = Micael (Pos 3) → ID: cfac7fdb

Match en DB:
  couple1_id = ba623368 (APolaik)
  couple2_id = cfac7fdb (Micael)
  result_couple1 = 6
  result_couple2 = 1

Dialog carga:
  couple1Score = result_couple1 = 6 ✅ CORRECTO (APolaik = couple1 en DB)
  couple2Score = result_couple2 = 1 ✅ CORRECTO (Micael = couple2 en DB)

Resultado mostrado: APolaik 6 - 1 Micael ✅ CORRECTO
```

### Escenario 2: Click desde Fila 3, Columna 1 (PROBLEMA)

```
Dialog abre con:
  couple1 = Micael (Pos 3) → ID: cfac7fdb
  couple2 = APolaik (Pos 1) → ID: ba623368

Match en DB:
  couple1_id = ba623368 (APolaik)
  couple2_id = cfac7fdb (Micael)
  result_couple1 = 6
  result_couple2 = 1

Dialog carga:
  couple1Score = result_couple1 = 6 ❌ INCORRECTO (Micael ≠ couple1 en DB)
  couple2Score = result_couple2 = 1 ❌ INCORRECTO (APolaik ≠ couple2 en DB)

Resultado mostrado: Micael 6 - 1 APolaik ❌ INVERTIDO!
```

---

## 🎯 Comparación con saveMatchResult

### saveMatchResult (CORRECTO) ✅

En `saveMatchResult` ([actions.ts:1397-1413](../app/api/tournaments/[id]/actions.ts#L1397-L1413)), implementamos una corrección:

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

**Esto funciona para GUARDAR**, pero falta la **misma lógica para MOSTRAR**.

---

## 💡 Solución Propuesta

### Estrategia:

Implementar la **misma lógica de corrección** en el dialog para VISUALIZACIÓN:

1. **Al cargar el dialog** (useEffect cuando `open` cambia)
2. **Comparar** `couple1.id` del dialog con `existingMatch.couple1_id` de DB
3. **Si coinciden:** Cargar scores directamente
4. **Si NO coinciden:** **INTERCAMBIAR** los scores antes de cargar

### Pseudocódigo:

```typescript
React.useEffect(() => {
  if (open && isFinished && existingMatch) {
    // ✅ CORRECCIÓN: Determinar qué score mostrar para qué pareja
    let displayCouple1Score: string;
    let displayCouple2Score: string;

    if (couple1.id === existingMatch.couple1_id) {
      // Orden correcto: couple1 del dialog = couple1 de DB
      displayCouple1Score = existingMatch.result_couple1?.toString() || '';
      displayCouple2Score = existingMatch.result_couple2?.toString() || '';
    } else if (couple1.id === existingMatch.couple2_id) {
      // Orden invertido: couple1 del dialog = couple2 de DB
      displayCouple1Score = existingMatch.result_couple2?.toString() || '';
      displayCouple2Score = existingMatch.result_couple1?.toString() || '';
    } else {
      // Error: IDs no coinciden con el match
      console.error('Couple IDs do not match the match record');
      displayCouple1Score = '';
      displayCouple2Score = '';
    }

    setCouple1Score(displayCouple1Score);
    setCouple2Score(displayCouple2Score);
    setCourt(existingMatch.court?.toString() || '');
    setIsEditing(false);
  }
}, [open, existingMatch, isFinished, couple1.id, couple2.id])
```

---

## 🔒 Validación de la Solución

### Test Case 1: Click desde Fila 1, Columna 3
```
couple1.id = ba623368 (APolaik)
existingMatch.couple1_id = ba623368

Comparación: couple1.id === existingMatch.couple1_id → TRUE

Carga:
  displayCouple1Score = existingMatch.result_couple1 = 6 ✅
  displayCouple2Score = existingMatch.result_couple2 = 1 ✅

Muestra: APolaik 6 - 1 Micael ✅ CORRECTO
```

### Test Case 2: Click desde Fila 3, Columna 1
```
couple1.id = cfac7fdb (Micael)
existingMatch.couple1_id = ba623368 (APolaik)

Comparación: couple1.id === existingMatch.couple1_id → FALSE
Comparación: couple1.id === existingMatch.couple2_id → TRUE

Carga (INTERCAMBIADO):
  displayCouple1Score = existingMatch.result_couple2 = 1 ✅
  displayCouple2Score = existingMatch.result_couple1 = 6 ✅

Muestra: Micael 1 - 6 APolaik ✅ CORRECTO
```

---

## 📁 Archivos Afectados

### Para Implementar la Corrección:

1. **`components/tournament/zones/components/ZoneMatchDialog.tsx`**
   - **Líneas a modificar:** [80-103](../components/tournament/zones/components/ZoneMatchDialog.tsx#L80-L103)
   - **Acción:** Agregar lógica de corrección de orden en el `useEffect`

### Archivos Relacionados (NO requieren cambios):

- ✅ `app/api/tournaments/[id]/actions.ts` → saveMatchResult ya está corregido
- ✅ `app/api/tournaments/[id]/route.ts` → PATCH handler correcto
- ✅ `components/tournament/zones/components/CoupleRow.tsx` → getMatchResult ya maneja orden correcto para mostrar en matriz

---

## 🎯 Impacto de la Corrección

### ✅ Funcionalidad Afectada:
- **Visualización de resultados finalizados** en dialog
- **Edición de resultados finalizados** (pre-carga de scores para editar)

### ❌ NO Afectado:
- Guardado de resultados → Ya funciona correctamente
- Visualización en matriz de zona → Ya funciona correctamente (CoupleRow maneja orden)
- Cálculo de posiciones → Ya funciona correctamente

### 🎨 Experiencia de Usuario:
**ANTES:**
- Click desde fila 1 → Muestra correcto ✅
- Click desde fila 3 → Muestra invertido ❌
- Confusión del usuario: "¿Quién ganó realmente?"

**DESPUÉS:**
- Click desde fila 1 → Muestra correcto ✅
- Click desde fila 3 → Muestra correcto ✅
- Consistencia total independiente de dónde se haga clic

---

## 🧪 Plan de Testing

### Test Manual Recomendado:

1. **Setup:**
   - Torneo americano con zona activa
   - Cargar un resultado: Pareja A (Pos 1) vs Pareja B (Pos 3) → 6-1

2. **Test 1: Visualización desde Fila 1**
   - Click en celda (Fila 1, Columna 3)
   - Verificar: Dialog muestra "Pareja A: 6 - Pareja B: 1"

3. **Test 2: Visualización desde Fila 3**
   - Click en celda (Fila 3, Columna 1)
   - Verificar: Dialog muestra "Pareja B: 1 - Pareja A: 6"

4. **Test 3: Edición desde cualquier celda**
   - Click en celda (cualquier orden)
   - Editar resultado a 7-5
   - Verificar: Se guarda correctamente en DB independiente del orden

5. **Test 4: Verificación en DB**
   ```sql
   SELECT couple1_id, couple2_id, result_couple1, result_couple2, winner_id
   FROM matches WHERE id = '...'
   ```
   - Verificar: `result_couple1` y `result_couple2` corresponden a los IDs correctos

---

## 📝 Conclusión

### Problema:
El dialog asume que `couple1` del dialog siempre es `couple1_id` de DB, pero esto es **falso**.

### Causa:
Falta de verificación del orden de couples al cargar scores para visualización.

### Solución:
Implementar la **misma lógica de corrección** que ya existe en `saveMatchResult`, pero en el `useEffect` del dialog.

### Complejidad:
**BAJA** - Solo requiere agregar 15-20 líneas de código en un `useEffect`.

### Riesgo:
**BAJO** - No afecta el guardado (ya funciona), solo mejora la visualización.

---

**Estado:** ✅ RESUELTO - Implementado en ZoneMatchDialog.tsx
**Fecha de resolución:** 2025-01-27
**Prioridad:** 🔥 ALTA - Afecta UX directamente
**Esfuerzo:** 🟢 BAJO - ~15 minutos de implementación

## ✅ Solución Implementada

La corrección fue implementada en [ZoneMatchDialog.tsx:83-108](../components/tournament/zones/components/ZoneMatchDialog.tsx#L83-L108):

```typescript
// ✅ CORRECCIÓN: Determinar qué score mostrar para qué pareja
let displayCouple1Score: string = ''
let displayCouple2Score: string = ''

if (couple1.id === existingMatch.couple1_id) {
  // Orden correcto: couple1 del dialog = couple1 de DB
  displayCouple1Score = existingMatch.result_couple1?.toString() || ''
  displayCouple2Score = existingMatch.result_couple2?.toString() || ''
} else if (couple1.id === existingMatch.couple2_id) {
  // Orden invertido: couple1 del dialog = couple2 de DB
  // INTERCAMBIAR los scores para mostrar correctamente
  displayCouple1Score = existingMatch.result_couple2?.toString() || ''
  displayCouple2Score = existingMatch.result_couple1?.toString() || ''
} else {
  // Error de seguridad: los IDs no coinciden con el match
  console.error('[ZoneMatchDialog] ERROR - Couple IDs do not match')
  displayCouple1Score = ''
  displayCouple2Score = ''
}

setCouple1Score(displayCouple1Score)
setCouple2Score(displayCouple2Score)
```

**Resultado:** Ahora el dialog muestra los scores correctamente independientemente de desde qué celda (fila/columna) se abra el match.
