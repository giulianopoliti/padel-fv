# Integration Flow - Points System

## Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER                          │
└─────────────────────────────────────────────────────────────────┘

1. User clicks "Calcular Puntos" button
   ↓
   components/tournament/bracket-v2/components/PointsCalculationBanner.tsx
   - Shows button when tournament is FINISHED_POINTS_PENDING
   - onClick → opens PointsReviewDialog

2. Dialog opens and loads preview
   ↓
   components/tournament/points-review-dialog.tsx
   - useEffect → fetch(`/api/tournaments/${tournamentId}/points`) [GET]
   - Displays preview table with player points
   - Shows dynamic bonuses based on tournament type ✅ UPDATED

3. User confirms
   ↓
   PointsCalculationBanner.handleConfirmPoints()
   - fetch(`/api/tournaments/${tournamentId}/points`, { method: 'POST' })
   - Updates tournament status to FINISHED_POINTS_CALCULATED

┌─────────────────────────────────────────────────────────────────┐
│                          API LAYER                              │
└─────────────────────────────────────────────────────────────────┘

app/api/tournaments/[id]/points/route.ts ✅ UPDATED

GET /api/tournaments/[id]/points
   ↓
   import { calculateTournamentPoints } from '@/lib/services/points'
   ↓
   const calculation = await calculateTournamentPoints(tournamentId, supabase)
   ↓
   Returns:
   {
     playerScores: [...],
     totalMatches: number,
     tournamentType: 'AMERICAN' | 'LONG',  ✅ NEW
     config: {
       bonusChampion: number,  ✅ NEW
       bonusFinalist: number   ✅ NEW
     }
   }

POST /api/tournaments/[id]/points
   ↓
   import { processTournamentPoints } from '@/lib/services/points'
   ↓
   const result = await processTournamentPoints(tournamentId, supabase)
   ↓
   Updates tournament.status = 'FINISHED_POINTS_CALCULATED'
   ↓
   Returns: { success: true, message: string }

┌─────────────────────────────────────────────────────────────────┐
│                       SERVICE LAYER                             │
└─────────────────────────────────────────────────────────────────┘

lib/services/points/ ✅ NEW IMPLEMENTATION

calculateTournamentPoints(tournamentId, supabase)
   ↓
   PointsCalculatorService.calculateTournamentPoints()
   ├── 1. Get tournament type from DB
   ├── 2. Get config: PointsConfigService.getConfig(type)
   ├── 3. Create snapshot of player scores
   ├── 4. Load snapshot map
   ├── 5. Get all finished matches
   ├── 6. For each match:
   │      ├── MatchPointsCalculator.calculateForMatch()
   │      │   ├── Get couples composition
   │      │   ├── Get player scores from snapshot
   │      │   ├── Calculate average scores
   │      │   └── EloPointsCalculator.calculate(scoreDiff, config)
   │      │       └── Returns { winnerPoints, loserPoints }
   │      └── Accumulate points per player
   ├── 7. BonusPointsCalculator.applyFinalBonuses()
   │      ├── Find final match
   │      ├── Get winner couple (champion)
   │      ├── Get loser couple (finalist)
   │      ├── Apply config.bonusChampion to winners
   │      └── Apply config.bonusFinalist to losers
   └── 8. Build PointsCalculationResult
       └── Returns full result with config ✅

processTournamentPoints(tournamentId, supabase)
   ↓
   PointsApplicationService.applyPoints(calculation, supabase)
   ├── 1. Update player scores in DB
   ├── 2. Save match_points_couples
   ├── 3. Save tournament_history
   └── 4. Recategorize players automatically

┌─────────────────────────────────────────────────────────────────┐
│                      CONFIGURATION                              │
└─────────────────────────────────────────────────────────────────┘

lib/services/points/types/points-config.types.ts

POINTS_CONFIGS = {
  AMERICAN: {
    baseWinner: 12,       // was 16
    baseLoser: -8,        // was -12
    bonusChampion: 30,    // was 40
    bonusFinalist: 10,    // was 20
    minWinnerPoints: 6,
    maxWinnerPoints: 24,
    minLoserPoints: -18,
    maxLoserPoints: -4
  },
  LONG: {
    baseWinner: 16,
    baseLoser: -12,
    bonusChampion: 60,
    bonusFinalist: 40,
    minWinnerPoints: 6,
    maxWinnerPoints: 36,
    minLoserPoints: -24,
    maxLoserPoints: -4
  }
}
```

## What Changed

### ✅ Updated Files

1. **app/api/tournaments/[id]/points/route.ts**
   - Import changed from `actions.ts` to `@/lib/services/points`
   - GET response now includes `tournamentType` and `config`

2. **components/tournament/points-review-dialog.tsx**
   - Interface updated with `tournamentType` and `config`
   - Dynamic bonus display: uses `config.bonusChampion` and `config.bonusFinalist`

### ✅ New Files (12 files)

All in `lib/services/points/`:
- Types, calculators, services, config
- Complete service architecture

### ✅ Unchanged Files (Frontend already correct)

These files were already using API routes correctly:
- `PointsCalculationBanner.tsx` - Uses fetch to API
- Frontend never called actions.ts directly ✅

## Example Flow for AMERICAN Tournament

```typescript
// 1. User clicks "Calcular Puntos"
// 2. Dialog opens, fetches preview

GET /api/tournaments/abc123/points

// 3. Service layer executes
const tournament = { type: 'AMERICAN' }
const config = {
  baseWinner: 12,
  baseLoser: -8,
  bonusChampion: 30,
  bonusFinalist: 10
}

// 4. Calculate match points
Match 1: Winner avg 500, Loser avg 300
  scoreDiff = 200
  step = 4
  Winner: 12 - 6 = 6 pts ✅
  Loser: -8 + 4 = -4 pts ✅

Match 2: Winner avg 300, Loser avg 500
  scoreDiff = -200
  step = 4
  Winner (underdog): 12 + 6 = 18 pts ✅
  Loser: -8 - 4 = -12 pts ✅

// 5. Apply final bonuses
Champion players: +30 pts each ✅
Finalist players: +10 pts each ✅

// 6. Return to frontend
{
  playerScores: [
    { playerName: "Juan Perez", pointsEarned: 48, bonus: 30, ... },
    { playerName: "Maria Lopez", pointsEarned: 10, bonus: 10, ... }
  ],
  tournamentType: "AMERICAN",
  config: {
    bonusChampion: 30,
    bonusFinalist: 10
  }
}

// 7. UI displays
"Bonus final: +30 pts para campeón, +10 pts para finalista" ✅
```

## Example Flow for LONG Tournament

Same flow, but with LONG config:
- Base: 16/-12
- Bonuses: 60/40
- Display: "+60 pts para campeón, +40 pts para finalista" ✅

## Testing Checklist

### Frontend
- [x] PointsCalculationBanner shows button correctly
- [x] PointsReviewDialog opens and loads preview
- [x] Preview shows player points correctly
- [ ] **Bonus text is dynamic** (needs testing with real data)
- [ ] Confirm button applies points
- [ ] Tournament status updates to FINISHED_POINTS_CALCULATED

### API
- [x] GET /points returns correct format with tournamentType
- [x] GET /points returns config with bonuses
- [x] POST /points applies points correctly
- [x] POST /points updates tournament status

### Services
- [x] PointsCalculatorService gets correct config for tournament type
- [x] EloPointsCalculator calculates correctly
- [x] BonusPointsCalculator applies correct bonuses
- [x] PointsApplicationService saves to DB correctly

## Summary

**✅ Frontend is already correctly integrated**
- Uses API routes (not direct function calls)
- API routes were updated to use new services
- Dialog updated to show dynamic bonuses

**✅ All layers connected**
- Frontend → API → Service → Database
- Configuration flows through all layers
- Type-safe throughout

**✅ Ready for testing**
- Test with AMERICAN tournament
- Test with LONG tournament
- Verify calculations and bonuses
