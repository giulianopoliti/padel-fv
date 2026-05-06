Quiero que me generes una **server action en TypeScript (Next.js 13+ con App Router)** que use el cliente oficial de Supabase.  
El objetivo es **actualizar las estadísticas de la tabla `zone_positions`** cada vez que se carga o edita un partido en un torneo largo (partidos a 3 sets).  

### Contexto
- La tabla `zone_positions` tiene estas columnas relevantes:
  - `couple_id` (pareja)
  - `zone_id`
  - `wins`
  - `loses`
  - `games_for`
  - `games_against`
  - `games_difference`
  - `sets_for`
  - `sets_against`
  - `set_difference`
  - `players_score_total`
  - `tie_info`
  - `position`
  - `calculated_at`

- Cada partido (`match`) tiene:
  - `id`
  - `zone_id`
  - `couple_a_id`
  - `couple_b_id`
  - `winner_id`
  - result_couple1
  -result_couple2, quiero usarlo como set ganado, es decir, 2-1, y cada set va en la table sets_matches.
  tiene referencia a la table sets_matches por foreign key.

### Requisitos de la acción
1. Recibe un objeto `match` y actualiza las estadísticas de las dos parejas involucradas.
   - Incrementa `wins` o `loses` según corresponda.
   - Suma `sets_for` y `sets_against`.
   - Suma `games_for` y `games_against`.
   - Calcula `games_difference` y `set_difference`.
   - Suma en `players_score_total` los games ganados.
2. Si el partido fue borrado, debe restar las estadísticas correspondientes.
3. Después de actualizar, recalcula las **posiciones** de toda la zona según un **orden configurable**:
   - Configuración default:
     1. `wins`
     2. `set_difference`
     3. `games_difference`
     4. head-to-head (si empataron 2 parejas)
     5. `games_for`
     6. `players_score_total`
     7. random (si sigue igual, registrar en `tie_info` que fue al azar)
4. Guardar en `zone_positions.tie_info` cómo se resolvió el empate.
5. Guardar en `zone_positions.position` el ranking final dentro de la zona.
6. Guardar `calculated_at = now()` cada vez que se recalcula.

### Extras
- La acción debe ser **idempotente**: si se llama varias veces con el mismo partido, no debe duplicar estadísticas.
- El orden de los criterios debe ser **configurable**, con un objeto tipo:

```ts
const rankingConfig = [
  "wins",
  "set_difference",
  "games_difference",
  "head_to_head",
  "games_for",
  "players_score_total",
  "random"
] as const;
