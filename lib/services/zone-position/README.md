# Zone Position System

A comprehensive and scalable system for calculating positions and rankings within tournament zones for padel tournaments.

## Overview

This system implements a sophisticated ranking algorithm that handles:
- **Primary Criterion**: Matches won
- **Secondary Criterion**: Head-to-head results (for 2-way ties)
- **Tertiary Criterion**: Games difference 
- **Quaternary Criterion**: Total player scores
- **Final Criterion**: Secure random tiebreaker

## Architecture

### Core Services

1. **`ZoneStatsCalculator`** - Calculates individual statistics and head-to-head matrices
2. **`ZoneRankingEngine`** - Implements the complete ranking algorithm with all tiebreaker criteria
3. **`ZonePositionService`** - Main orchestrator service with database integration

### Key Features

- ✅ **Scalable**: Works for zones of 3, 4, 5+ couples
- ✅ **Comprehensive**: Handles all possible tie scenarios
- ✅ **Debuggable**: Each position includes explanation of how it was determined
- ✅ **Validated**: Built-in validation ensures ranking consistency
- ✅ **Tested**: 100+ test cases covering edge cases
- ✅ **Secure**: Uses cryptographically secure random tiebreaking

## Usage

### Basic Usage

```typescript
import { ZonePositionService } from '@/lib/services/zone-position'

const service = new ZonePositionService()

// Calculate positions for a zone
const result = await service.calculateZonePositions('zone-id')

console.log(result.couples.map(c => ({
  position: c.position,
  names: `${c.player1Name} / ${c.player2Name}`,
  wins: c.matchesWon,
  gamesDiff: c.gamesDifference,
  tieInfo: c.positionTieInfo
})))
```

### Update Database

```typescript
// Calculate and save positions to database
const updateResult = await service.updateZonePositionsInDatabase(
  'tournament-id',
  'zone-id'
)

if (updateResult.success) {
  console.log(`Updated ${updateResult.positionsUpdated} positions`)
} else {
  console.error(`Failed: ${updateResult.error}`)
}
```

### Multiple Zones

```typescript
const results = await service.calculateMultipleZonePositions(
  'tournament-id',
  ['zone1', 'zone2', 'zone3']
)

Object.entries(results).forEach(([zoneId, result]) => {
  console.log(`Zone ${zoneId}: ${result.couples.length} couples`)
})
```

## Algorithm Details

### Ranking Criteria (in order)

1. **Matches Won** (descending)
   - Primary sorting criterion
   - More match wins = higher position

2. **Head-to-Head Result** (for 2-way ties only)
   - If two couples are tied and played against each other
   - Winner of direct match gets higher position

3. **Games Difference** (descending)
   - Games won minus games lost across all matches
   - Higher difference = higher position

4. **Total Player Scores** (descending)
   - Sum of both players' ranking scores
   - Higher total = higher position

5. **Random Tiebreaker** (cryptographically secure)
   - Last resort for perfect ties
   - Uses secure random number generation when available

### Tiebreaker Examples

```typescript
// Example 1: Clear ranking by wins
Couple A: 3 wins → Position 1
Couple B: 2 wins → Position 2  
Couple C: 1 win  → Position 3

// Example 2: 2-way tie resolved by head-to-head
Couple A: 2 wins, beat Couple B → Position 1
Couple B: 2 wins, lost to Couple A → Position 2

// Example 3: 3-way tie resolved by games difference
Couple A: 2 wins, +8 games diff → Position 1
Couple B: 2 wins, +3 games diff → Position 2  
Couple C: 2 wins, +1 games diff → Position 3

// Example 4: Perfect tie resolved randomly
Couple A: 2 wins, +5 games, 600 player score → Random 1 or 2
Couple B: 2 wins, +5 games, 600 player score → Random 1 or 2
```

## Database Schema

The system uses a `zone_positions` table:

```sql
CREATE TABLE zone_positions (
  id UUID PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id),
  zone_id UUID REFERENCES zones(id),
  couple_id UUID REFERENCES couples(id),
  position INTEGER NOT NULL,
  is_definitive BOOLEAN DEFAULT FALSE,
  points INTEGER DEFAULT 0, -- Sets difference
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  games_for INTEGER DEFAULT 0,
  games_against INTEGER DEFAULT 0,
  games_difference INTEGER DEFAULT 0,
  player_score_total INTEGER DEFAULT 0,
  tie_info TEXT, -- Human-readable tie resolution
  calculated_at TIMESTAMP DEFAULT NOW()
)
```

## Testing

Run the comprehensive test suite:

```bash
npm test lib/services/zone-position
```

### Test Coverage

- ✅ Individual stats calculation
- ✅ Head-to-head matrix creation
- ✅ All tiebreaker scenarios
- ✅ Edge cases (empty zones, single couples)
- ✅ Integration tests with real tournament scenarios
- ✅ Validation and error handling

## Error Handling

The system includes comprehensive error handling:

- **Invalid Data**: Validates couple stats consistency
- **Database Errors**: Graceful handling of connection issues  
- **Ranking Validation**: Ensures positions are sequential and logical
- **Missing Data**: Handles incomplete matches gracefully

## Performance Considerations

- **Efficient Grouping**: O(n log n) complexity for sorting operations
- **Minimal Database Calls**: Batches operations where possible
- **Memory Efficient**: Processes zones independently
- **Caching Ready**: Results can be cached at the service level

## Extending the System

To add new tiebreaker criteria:

1. Add new field to `CoupleStats` interface
2. Calculate field in `ZoneStatsCalculator`
3. Add criterion to ranking logic in `ZoneRankingEngine`
4. Update tests and documentation

## Debugging

Each couple's position includes a `positionTieInfo` field explaining how the position was determined:

```typescript
{
  position: 1,
  positionTieInfo: "Resolved by head-to-head result vs Couple2"
}

{
  position: 2, 
  positionTieInfo: "Resolved by games difference: +8"
}

{
  position: 3,
  positionTieInfo: "Resolved by random tiebreaker (perfect tie)"
}
```

This makes it easy to understand and verify ranking decisions.