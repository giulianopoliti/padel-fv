# Tournament Points System

Complete tournament points calculation system with ELO-like algorithm that supports different tournament types (AMERICAN, LONG) with configurable point values.

## Architecture

```
lib/services/points/
├── types/                           # Type definitions
│   ├── points-config.types.ts       # Configuration types
│   ├── points-calculation.types.ts  # Calculation types
│   └── index.ts                     # Type exports
├── config/
│   └── points.config.service.ts     # Configuration service
├── calculators/
│   ├── elo-points.calculator.ts     # ELO algorithm
│   ├── match-points.calculator.ts   # Match-level calculation
│   └── bonus-points.calculator.ts   # Final bonuses
├── services/
│   ├── points.calculator.service.ts # Main orchestrator
│   └── points.application.service.ts # Database application
└── index.ts                         # Main exports
```

## Points Configuration

### AMERICAN Tournament
- **Base Winner:** 12 pts
- **Base Loser:** -8 pts
- **Champion Bonus:** +30 pts
- **Finalist Bonus:** +10 pts
- **Winner Range:** 6 to 24 pts
- **Loser Range:** -18 to -4 pts

### LONG Tournament
- **Base Winner:** 16 pts
- **Base Loser:** -12 pts
- **Champion Bonus:** +60 pts
- **Finalist Bonus:** +40 pts
- **Winner Range:** 6 to 36 pts
- **Loser Range:** -24 to -4 pts

## How It Works

### 1. ELO-Like Algorithm

Points are calculated based on the score difference between winner and loser:

```typescript
scoreDiff = winnerAvgScore - loserAvgScore
step = floor(abs(scoreDiff) / 50)
winnerAdjust = step * 1.5
loserAdjust = step * 1.0

if scoreDiff > 0:  // Winner was favorite
  winnerPoints = baseWinner - winnerAdjust
  loserPoints = baseLoser + loserAdjust
else:  // Winner was underdog
  winnerPoints = baseWinner + winnerAdjust
  loserPoints = baseLoser - loserAdjust
```

**Example:**
- Winner avg: 500 pts, Loser avg: 300 pts
- scoreDiff = 200
- step = 4, winnerAdjust = 6, loserAdjust = 4
- Winner (favorite): 12 - 6 = **6 pts**
- Loser: -8 + 4 = **-4 pts**

### 2. Calculation Flow

1. **Create Snapshot:** Save player scores at tournament start
2. **Calculate Matches:** Process all finished matches with ELO
3. **Apply Bonuses:** Add champion/finalist bonuses
4. **Build Result:** Compile all player updates
5. **Apply to DB:** Update scores and save history
6. **Recategorize:** Auto-adjust player categories

## Usage

### Calculate Points (Preview)

```typescript
import { calculateTournamentPoints } from '@/lib/services/points';

const result = await calculateTournamentPoints(tournamentId, supabase);

console.log(result.tournamentType); // 'AMERICAN' or 'LONG'
console.log(result.config); // Point configuration used
console.log(result.playerUpdates); // Preview of changes
```

### Apply Points

```typescript
import { processTournamentPoints } from '@/lib/services/points';

const result = await processTournamentPoints(tournamentId, supabase);

if (result.success) {
  console.log('Points applied successfully!');
}
```

### Get Configuration

```typescript
import { PointsConfigService } from '@/lib/services/points';

const config = PointsConfigService.getConfig('AMERICAN');
console.log(`Winner: ${config.baseWinner}, Loser: ${config.baseLoser}`);
```

### Direct Service Usage

```typescript
import {
  PointsCalculatorService,
  PointsApplicationService
} from '@/lib/services/points';

// Calculate
const calculation = await PointsCalculatorService.calculateTournamentPoints(
  tournamentId,
  supabase
);

// Apply
await PointsApplicationService.applyPoints(calculation, supabase);
```

## Key Features

✅ **Type-Safe:** Full TypeScript support with strict types
✅ **Configurable:** Easy to add new tournament types
✅ **Testable:** Each component can be tested independently
✅ **Snapshot System:** Uses player scores at tournament start
✅ **ELO Algorithm:** Fair points based on opponent strength
✅ **Bonus System:** Automatic champion/finalist bonuses
✅ **History Tracking:** Saves all changes to database
✅ **Auto-Recategorization:** Updates player categories
✅ **Logging:** Comprehensive console logging for debugging

## Adding New Tournament Type

1. Update `TournamentType` in `points-config.types.ts`
2. Add configuration to `POINTS_CONFIGS`
3. That's it! System will automatically use new config

```typescript
export const POINTS_CONFIGS = {
  AMERICAN: { ... },
  LONG: { ... },
  CUSTOM: {  // New type
    baseWinner: 20,
    baseLoser: -10,
    bonusChampion: 50,
    bonusFinalist: 25,
    // ... limits
  }
};
```

## Migration from actions.ts

Old code in `app/api/tournaments/actions.ts` is still functional but should be gradually replaced:

```typescript
// ❌ Old way (in actions.ts)
await calculateTournamentPoints(tournamentId, supabase);

// ✅ New way (using service)
import { calculateTournamentPoints } from '@/lib/services/points';
await calculateTournamentPoints(tournamentId, supabase);
```

The API is identical, making migration seamless.

## Testing

```typescript
import { EloPointsCalculator, POINTS_CONFIGS } from '@/lib/services/points';

const config = POINTS_CONFIGS.AMERICAN;
const result = EloPointsCalculator.calculate(200, config);

expect(result.winnerPoints).toBe(6);
expect(result.loserPoints).toBe(-4);
```
