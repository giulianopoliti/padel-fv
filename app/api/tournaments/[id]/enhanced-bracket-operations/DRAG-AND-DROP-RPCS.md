# RPCs de Drag and Drop - Sistema de Brackets

## Descripción General

El sistema de drag and drop utiliza **3 RPCs especializados** para manejar diferentes tipos de operaciones de movimiento de parejas en los brackets de torneos.

## 1. `swap_bracket_positions_atomic`

**Función:** Intercambia dos parejas entre diferentes posiciones del bracket.

**Cuándo se usa:** 
- Operación tipo `swap`
- Ambas posiciones tienen parejas
- Se intercambian las posiciones de las parejas

**Ejemplo:**
- Posición A: Pareja 1 
- Posición B: Pareja 2
- **Resultado:** Posición A: Pareja 2, Posición B: Pareja 1

**Características:**
- Intercambio atómico en una transacción
- Actualiza `match_hierarchy` automáticamente
- Mantiene coherencia de estados

## 2. `couple_to_empty_swap`

**Función:** Mueve una pareja a una posición vacía del bracket.

**Cuándo se usa:**
- Operación tipo `move-to-empty`
- Posición origen tiene pareja
- Posición destino está vacía (NULL)

**Ejemplo:**
- Posición A: Pareja 1
- Posición B: [VACÍA]
- **Resultado:** Posición A: [VACÍA], Posición B: Pareja 1

**Características:**
- Mueve pareja y deja slot origen vacío
- Actualiza `match_hierarchy` para mantener coherencia
- **✅ ACTUALIZA ESTADOS:** Cambia status de partidos según cantidad de parejas
  - 2 parejas → `PENDING`
  - <2 parejas → `WAITING_OPONENT`

## 3. `couple_to_placeholder_swap`

**Función:** Mueve una pareja real a reemplazar un placeholder (ganador de otro partido).

**Cuándo se usa:**
- Operación tipo `move-to-placeholder`
- Posición origen tiene pareja real
- Posición destino tiene placeholder ("Winner of...")

**Ejemplo:**
- Posición A: Pareja 1
- Posición B: "Winner of Semifinal 1"
- **Resultado:** Posición A: [VACÍA], Posición B: Pareja 1

**Características:**
- Reemplaza placeholder con pareja real
- Mantiene jerarquía del torneo
- Actualiza referencias en `match_hierarchy`

## Decisión de Uso

La lógica de decisión está en `/enhanced-bracket-operations/route.ts`:

```typescript
switch (operation.operationType) {
  case 'swap':
    return processSwapOperation()        // → swap_bracket_positions_atomic
    
  case 'move-to-empty':
    return processMoveToEmptyOperation() // → couple_to_empty_swap
    
  case 'move-to-placeholder':
    return processMoveToPlaceholderOperation() // → couple_to_placeholder_swap
}
```

**Determinación automática:**
- Frontend detecta el tipo de operación basado en el contenido del slot destino
- Si destino tiene pareja → `swap`
- Si destino está vacío → `move-to-empty`  
- Si destino es placeholder → `move-to-placeholder`

## Flujo Completo

1. **Usuario arrastra pareja** en el frontend
2. **Sistema detecta tipo** de operación (swap/move-to-empty/move-to-placeholder)
3. **API llama al RPC** correspondiente
4. **RPC actualiza:**
   - Tabla `matches` (posiciones de parejas)
   - Tabla `match_hierarchy` (relaciones padre-hijo)
   - **Estados de partidos** (PENDING/WAITING_OPONENT)
5. **Frontend actualiza** visualización automáticamente

## Estados de Partidos

Los RPCs actualizan automáticamente los estados:

- **`PENDING`**: Partido tiene 2 parejas, listo para jugarse
- **`WAITING_OPONENT`**: Partido esperando segunda pareja
- **`COMPLETED`**: Partido terminado con resultado
- **`BYE`**: Partido con pase libre

**Regla clave:** Después de cualquier movimiento, si un partido tiene 2 parejas → `PENDING`, si no → `WAITING_OPONENT`