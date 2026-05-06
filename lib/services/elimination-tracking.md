# Elimination Tracking Service

Sistema para marcar parejas eliminadas del torneo en la tabla `inscriptions`.

## Función Principal

```typescript
markEliminatedCouples(
  tournamentId: string,
  eliminatedCouples: string[], // couple_ids
  eliminatedInRound: 'ZONE' | '32VOS' | '16VOS' | '8VOS' | '4TOS' | 'SEMIFINAL' | 'FINAL',
  supabase: any
): Promise<void>
```

## Uso Actual

- **Qualifying Advancement**: Parejas que no avanzan de fase de zonas se marcan como eliminadas en `ZONE`
- Ubicación: `utils/bracket-seeding-algorithm.ts`

## Campos Actualizados

- `is_eliminated`: `true`
- `eliminated_at`: timestamp actual
- `eliminated_in_round`: ronda donde se eliminó

## Ejemplo

```typescript
// Eliminar parejas que no clasifican
await markEliminatedCouples(tournamentId, ['couple-1', 'couple-2'], 'ZONE', supabase);
```