# 🎯 FINDINGS SUMMARY: Zone Duplicate Bug Investigation

## 📊 What We Discovered

### ✅ POSITIVE FINDINGS

1. **Backtracking Algorithm is CORRECT**
   - The `SingleZoneDefinitiveAnalyzer` correctly identifies when positions are non-definitive
   - In AMERICAN 2 format, couple with 2W-0L CAN be surpassed by another couple with better tiebreaker
   - Test confirms algorithm works as designed

2. **resolveSeeds() Has Idempotency Guard**
   - File: `lib/services/incremental-bracket-updater.ts:231`
   - Code: `.eq('is_placeholder', true)`
   - This PREVENTS updating already-resolved seeds
   - Protection is already in place!

3. **Test Infrastructure Created**
   - File: `lib/services/__tests__/zone-duplicate-bug.test.ts`
   - 5 comprehensive tests created
   - All tests pass ✅
   - Can be used for future debugging

---

## ❓ REMAINING QUESTIONS

### Question 1: If the guard exists, why does duplication still happen?

**Possible Scenarios:**

#### Scenario A: The bug is in INITIAL bracket generation
```typescript
// generatePlaceholderBracketAction (actions.ts:2832-2981)
// When generating bracket, does it:
1. Create seeds with is_placeholder = true
2. Immediately mark some as definitive
3. Resolve those seeds (is_placeholder = false)
4. THEN complete a zone match
5. Position recalculates
6. Tries to resolve AGAIN
```

But wait - if `is_placeholder = true` guard is in place, step 6 would fail (no match found).

#### Scenario B: The bug is in zone_positions, not seeds
```
// What if the problem is:
1. zone_positions has is_definitive = true for couple A (position 2)
2. Couple A migrates to seed "2B"
3. Zone match completes
4. zone_positions RECALCULATES: couple C is now position 2, is_definitive = true
5. Couple C tries to migrate to seed "2B"
6. Query: WHERE placeholder_zone_id = B AND placeholder_position = 2 AND is_placeholder = true
7. Result: NO MATCH (seed "2B" has is_placeholder = false)
8. ❌ Migration FAILS - Couple C is NOT migrated!
```

This would cause:
- Couple A remains in seed "2B" (incorrect)
- Couple C never gets migrated (missing from bracket)
- NO duplication, but WRONG couples in bracket

#### Scenario C: The bug is when CLEARING placeholder fields
```typescript
// In resolveSeeds() (incremental-bracket-updater.ts:220-226)
.update({
  couple_id: resolution.coupleId,
  is_placeholder: false,
  placeholder_zone_id: null,  ← Cleared
  placeholder_position: null, ← Cleared
  placeholder_label: null
})
```

After this update:
- `placeholder_zone_id = null`
- `placeholder_position = null`

Next resolution attempt:
```sql
UPDATE tournament_couple_seeds
SET couple_id = 'couple-C'
WHERE tournament_id = ?
  AND placeholder_zone_id = 'zone-B'  -- NULL != 'zone-B' → NO MATCH
  AND placeholder_position = 2        -- NULL != 2 → NO MATCH
  AND is_placeholder = true
```

Result: **NO UPDATE HAPPENS**

---

## 🔍 NEW HYPOTHESIS: The Bug is NOT in resolveSeeds()

Based on the code review, I believe the bug is elsewhere:

### Hypothesis D: The bug is in how updateDefinitiveFlags() works

When a zone match completes AFTER bracket generation:

1. `updateZonePositions()` is called
2. `SingleZoneDefinitiveAnalyzer` recalculates is_definitive
3. Some positions change from `is_definitive = true` to `is_definitive = false`
4. **But the couples are ALREADY in tournament_couple_seeds!**
5. System tries to "un-migrate" them? Creates duplicates?

### Hypothesis E: Double INSERT instead of UPDATE

Maybe the bug is not in UPDATE, but in INSERT:

```typescript
// Somewhere in the code:
1. Generate bracket → INSERT seed "2B" with couple_id = A
2. Zone match completes
3. System thinks "2B" needs to be created
4. INSERT another seed "2B" with couple_id = C
5. Result: 2 seeds for position "2B"
```

---

## 🧪 NEXT STEPS TO FIND THE REAL BUG

### Step 1: Add Logging to Production
Add extensive logging to track:
- When `tournament_couple_seeds` rows are INSERTED
- When they are UPDATED
- What triggers each operation

### Step 2: Check for INSERT Statements
```bash
grep -r "INSERT.*tournament_couple_seeds" lib/
grep -r "\.insert\(.*" lib/ | grep -i "seed"
```

### Step 3: Run Full Integration Test
Create a test that:
1. Generates full bracket with placeholders
2. Completes zone matches incrementally
3. Logs ALL database changes to `tournament_couple_seeds`
4. Detects duplicates

### Step 4: Check Database Constraints
Verify if `tournament_couple_seeds` table has UNIQUE constraint on:
- (tournament_id, couple_id) ← Should prevent duplicates
- (tournament_id, seed) ← Should prevent duplicate seeds

If no constraint exists, duplicates are possible!

---

## 📝 RECOMMENDATIONS

1. ✅ **Keep the tests we created** - they validate algorithm correctness
2. 🔍 **Check for INSERT operations** - the bug might be creating new seeds instead of updating
3. 🛡️ **Add database constraint** - UNIQUE(tournament_id, couple_id) to prevent duplicates
4. 📊 **Add audit logging** - Track all tournament_couple_seeds changes
5. 🧪 **Create full integration test** - Reproduce the exact scenario from production

---

## 🤔 QUESTIONS FOR USER

1. **When you see duplicates, are they:**
   - Same seed number, different couple_ids? (e.g., seed=3 appears twice)
   - Same couple_id, different seed numbers? (e.g., couple A in seeds 3 and 5)
   - Both?

2. **Does the duplication happen:**
   - During initial bracket generation?
   - After completing a zone match?
   - Both?

3. **Can you share the actual duplicate rows** from `tournament_couple_seeds` table?
   This would help identify the exact pattern.

---

## 💡 CONCLUSION

The investigation revealed:
- ✅ Backtracking algorithm is correct
- ✅ Idempotency guard exists in `resolveSeeds()`
- ❓ Bug location remains unknown - likely NOT in the places we examined
- 🎯 Next step: Search for INSERT statements and check database constraints

The bug is real, but it's hiding somewhere we haven't looked yet. The tests we created will help catch it once we find the actual problematic code path.
