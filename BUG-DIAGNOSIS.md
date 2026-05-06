# 🔴 BUG DIAGNOSIS: Couple Duplication in Tournament Bracket

## 📊 Summary
**Status**: BUG CONFIRMED via Test
**Root Cause**: Backtracking algorithm incorrectly marks positions as non-definitive when they mathematically cannot change
**Impact**: Causes couples to be migrated multiple times to `tournament_couple_seeds`, creating duplicates

---

## 🧪 Test Results

### Test 1: Asymmetric Pending Matches (AMERICAN 2 Format)

**Scenario**:
- Zone with 4 couples (A, B, C, D)
- AMERICAN 2 format: Each couple plays exactly 2 matches
- Total: 4 matches in zone

**Matches**:
```
Match 1: A vs B → A wins 6-4 (FINISHED)
Match 2: C vs D → C wins 6-2 (FINISHED)
Match 3: A vs D → A wins 6-3 (FINISHED)
Match 4: B vs C → PENDING
```

**Current State** (after 3 finished, 1 pending):
- **Couple A**: 2W-0L (2 matches played, COMPLETE)
- **Couple C**: 1W-0L (1 match played, 1 pending)
- **Couple B**: 0W-1L (1 match played, 1 pending)
- **Couple D**: 0W-2L (2 matches played, COMPLETE)

### ❌ Actual Behavior (INCORRECT)
```
Couple A:
  Current position: 1
  Is definitive: FALSE  ← ❌ BUG!
  Possible positions: [1, 2]  ← ❌ IMPOSSIBLE!
  Method: BACKTRACKING

Couple C:
  Current position: 2
  Is definitive: FALSE
  Possible positions: [1, 2, 3]  ← ❌ Can't be 1st (A has 2W already)
  Method: BACKTRACKING

Couple B:
  Current position: 3
  Is definitive: FALSE
  Possible positions: [2, 3, 4]  ← ❌ Can't be 2nd (C can't drop below 2nd)
  Method: BACKTRACKING

Couple D:
  Current position: 4
  Is definitive: FALSE  ← ❌ BUG!
  Possible positions: [3, 4]  ← ❌ Can only be 4th!
  Method: BACKTRACKING
```

### ✅ Expected Behavior (CORRECT)
```
Couple A (2W-0L, complete):
  Is definitive: TRUE
  Possible positions: [1]
  Reason: Has won both matches, cannot be surpassed

Couple D (0W-2L, complete):
  Is definitive: TRUE
  Possible positions: [4]
  Reason: Has lost both matches, cannot improve

Couple C (1W-0L, 1 pending):
  Is definitive: FALSE
  Possible positions: [2, 3]
  Reason: If wins → 2W-0L (2nd), if loses → 1W-1L (2nd or 3rd depending on tiebreaker)

Couple B (0W-1L, 1 pending):
  Is definitive: FALSE
  Possible positions: [2, 3]
  Reason: If wins → 1W-1L (could be 2nd or 3rd), if loses → 0W-2L (3rd)
```

---

## 🔍 Root Cause Analysis

### Problem Location
File: `lib/services/single-zone-definitive-analyzer.ts`
Function: `performBacktracking()` (lines 299-368)

### Issue
The backtracking algorithm explores ALL mathematical combinations of pending match results, **but does NOT respect constraints from couples who have already completed all their matches**.

### Specific Bug
When simulating scenarios, the algorithm allows couples with **complete records** (e.g., A with 2W-0L) to change position, which is impossible.

**Example of Impossible Scenario**:
```typescript
// Current state:
// A: 2W-0L (complete, no more matches)
// C: 1W-0L (1 match pending)

// Backtracking generates scenario where:
// Match B vs C: C wins 6-0
// Result: C = 2W-0L

// Ranking simulation:
// C: 2W-0L, games_for: 12
// A: 2W-0L, games_for: 12
// Both tied at 2W → Tiebreaker by games_for
// If C scores exactly 12 games, C could rank above A

// ❌ PROBLEM: This scenario is IMPOSSIBLE if A already has 2W-0L
// because C cannot surpass A when both have perfect records
// unless there's additional context we're not considering
```

**Wait... let me reconsider:**

Actually, if both have 2W-0L, the tiebreaker is:
1. Wins (tied at 2)
2. Games difference
3. Games for

If C wins 6-0 against B, C would have:
- Match 1 vs D: 6-2 (won)
- Match 2 vs B: 6-0 (won)
- Total: 12 games for, 2 against, +10 difference

A would have:
- Match 1 vs B: 6-4 (won)
- Match 2 vs D: 6-3 (won)
- Total: 12 games for, 7 against, +5 difference

**C would rank ABOVE A** due to better games difference (+10 vs +5)!

**WAIT - This means the backtracking is actually CORRECT** for couple A!

Let me re-analyze...

---

## 🔄 REVISED ANALYSIS

### Actually, the backtracking might be correct...

**Couple A CAN be 2nd place** if:
- C wins B-C match with a high score (e.g., 6-0 or 6-1)
- C ends up with 2W-0L and better games difference than A

**Let me verify with the test data**:

A's current stats:
- games_for: 12 (from 6-4 + 6-3)
- games_against: 7
- games_difference: +5

C's current stats:
- games_for: 6 (from one 6-2 win)
- games_against: 2
- games_difference: +4

If C wins B-C as 6-0:
- C total: games_for=12, games_against=2, difference=+10
- C ranks ABOVE A (better difference)

If C wins B-C as 7-6:
- C total: games_for=13, games_against=8, difference=+5
- Tied with A, tiebreaker by games_for: C=13 > A=12
- C ranks ABOVE A

**CONCLUSION**: The backtracking is actually CORRECT! 🎯

---

## ✅ CORRECTED UNDERSTANDING

The algorithm is working as designed. The issue you're experiencing is likely NOT in the definitive position analyzer, but in:

1. **How positions are migrated to `tournament_couple_seeds`**
2. **When the migration happens** (before all zone matches complete)
3. **Whether the migration is idempotent** (prevents duplicates)

---

## 🎯 NEW HYPOTHESIS: Real Bug Location

The bug is likely in `incremental-bracket-updater.ts` in the `resolveSeeds()` function:

```typescript
// Line 228-232
const { data: seedData, error } = await supabase
  .from('tournament_couple_seeds')
  .update({ couple_id: resolution.coupleId, ...})
  .eq('placeholder_zone_id', resolution.zoneId)
  .eq('placeholder_position', resolution.position)
  // ❌ MISSING: .eq('is_placeholder', true)
```

**Without this guard**, if a position changes from couple A to couple B:
1. First resolution: Updates seed WHERE zone=B AND position=2 → Sets couple_id=A
2. Position recalculated: B is now 2nd instead of A
3. Second resolution: Updates SAME seed WHERE zone=B AND position=2 → Sets couple_id=B
4. Result: Couple A is orphaned, couple B is in the seed

**But if there's a NEW seed created for position 3 (where A dropped to):**
5. Third resolution: Updates seed WHERE zone=B AND position=3 → Sets couple_id=A
6. Result: BOTH A and B are in seeds, or A appears twice!

---

## 📝 Next Steps

1. ✅ **Test confirmed backtracking works correctly for AMERICAN 2 format**
2. ⚠️ **Need to test the REAL bug**: Migration/resolution process
3. 🔧 **Create Test 5**: Simulate full bracket generation + position change + re-resolution
4. 🛠️ **Implement fix**: Add `is_placeholder = true` guard in `resolveSeeds()`

---

## 🧪 Test 5 Needed (Integration Test)

```typescript
test('should not migrate same couple twice when position changes', async () => {
  // 1. Generate bracket (couple A is 2nd)
  // 2. Resolve seed "2B" → couple_id = A
  // 3. Complete zone match
  // 4. Position recalculates: couple B is now 2nd
  // 5. Try to resolve seed "2B" again
  // 6. Verify: Does NOT update (is_placeholder = false)
  // 7. Verify: couple A appears only once in seeds
})
```
