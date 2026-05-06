# 🗄️ RPC Functions Documentation - Enhanced Bracket Swap System

## 📋 Overview

This document describes the RPC functions created for the enhanced bracket swap system that supports three types of operations with atomic transactions and comprehensive validation.

## 🔧 RPC Functions

### 1. `swap_bracket_positions_atomic`

**Primary function for COUPLE_TO_COUPLE swaps with enhanced validation and audit logging.**

#### Function Signature
```sql
swap_bracket_positions_atomic(
  p_tournament_id uuid,
  p_user_id uuid,
  p_source_match_id uuid,
  p_target_match_id uuid,
  p_source_slot text,
  p_target_slot text,
  p_operation_id text
) RETURNS jsonb
```

#### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `p_tournament_id` | uuid | Tournament UUID |
| `p_user_id` | uuid | User performing the operation |
| `p_source_match_id` | uuid | Source match UUID |
| `p_target_match_id` | uuid | Target match UUID |
| `p_source_slot` | text | Source slot (`'couple1_id'` or `'couple2_id'`) |
| `p_target_slot` | text | Target slot (`'couple1_id'` or `'couple2_id'`) |
| `p_operation_id` | text | Unique operation identifier for tracing |

#### Validations Performed
1. **Parameter Validation**: All required parameters present and valid
2. **Permission Check**: User belongs to same club as tournament
3. **Match Existence**: Both matches exist and belong to tournament
4. **Same Round**: Source and target matches in same tournament round
5. **Match Status**: Both matches must be PENDING
6. **Couple Presence**: Both slots must contain couples (no NULL values)
7. **No Self-Swap**: Cannot move couple to same position

#### Database Operations
- Locks both matches with `FOR UPDATE` to prevent race conditions
- Swaps couple positions atomically
- Updates `tournament_couple_seeds` bracket positions if table exists
- Creates comprehensive audit log entry
- Handles all operations within single transaction

#### Success Response
```json
{
  "success": true,
  "operation_id": "swap_1756752512386_lj8fghxi0",
  "details": {
    "swapped_couples": {
      "source": "uuid-source-couple",
      "target": "uuid-target-couple"
    },
    "source_match_id": "uuid-source-match",
    "target_match_id": "uuid-target-match",
    "source_slot": "couple1_id",
    "target_slot": "couple2_id",
    "tournament_id": "uuid-tournament",
    "timestamp": "2025-01-19T10:30:00Z"
  }
}
```

#### Error Response
```json
{
  "success": false,
  "error": "Source match must be PENDING status",
  "operation_id": "swap_1756752512386_lj8fghxi0",
  "error_code": "P0001"
}
```

---

### 2. `couple_to_empty_swap`

**Function for COUPLE_TO_EMPTY swaps - moves couple to TBD slot and updates match_hierarchy.**

#### Function Signature
```sql
couple_to_empty_swap(
  p_tournament_id uuid,
  p_user_id uuid,
  p_source_match_id uuid,
  p_source_slot text,
  p_source_couple_id uuid,
  p_target_match_id uuid,
  p_target_slot text,
  p_operation_id text
) RETURNS jsonb
```

#### Key Operations
- Moves couple from occupied slot to empty TBD slot
- Updates `match_hierarchy` table to redirect child matches
- Updates match statuses appropriately
- Creates audit trail for hierarchy changes

#### When Used
- Target slot is completely empty (NULL couple_id, NULL placeholder)
- Typically used when reorganizing bracket structure
- Affects downstream match dependencies

---

### 3. `couple_to_placeholder_swap`

**Function for COUPLE_TO_PLACEHOLDER swaps - swaps couple with placeholder and updates seeds.**

#### Function Signature
```sql
couple_to_placeholder_swap(
  p_tournament_id uuid,
  p_user_id uuid,
  p_source_match_id uuid,
  p_source_slot text,
  p_source_couple_id uuid,
  p_target_match_id uuid,
  p_target_slot text,
  p_operation_id text
) RETURNS jsonb
```

#### Key Operations
- Swaps real couple with placeholder (e.g., "3C", "2A")
- Exchanges `tournament_couple_seed_ids` 
- Resolves placeholder with actual couple
- Maintains seeding integrity

#### When Used
- Target slot contains placeholder waiting for zone result
- Placeholder has associated `tournament_couple_seed_id`
- Common during bracket reorganization with seeding

---

## 🔒 Security Features

### Permission System
- All functions use `SECURITY DEFINER` 
- User must belong to same club as tournament
- Validated through `user_details_v` view
- Tournament club ownership verified

### Race Condition Prevention
- `SELECT ... FOR UPDATE` locks on all affected matches
- Atomic transactions - all operations succeed or fail together
- Automatic rollback on any error
- Minimal lock duration for optimal performance

### Audit Logging
All functions create detailed audit entries:
```sql
INSERT INTO audit_logs (
  table_name,
  operation,
  record_id,
  old_values,
  new_values,
  user_id,
  created_at,
  metadata
)
```

## 🧪 Testing Examples

### Example 1: Basic Couple Swap
```sql
SELECT swap_bracket_positions_atomic(
  'tournament-uuid'::uuid,
  'user-uuid'::uuid,
  'source-match-uuid'::uuid,
  'target-match-uuid'::uuid,
  'couple1_id',
  'couple2_id',
  'swap_test_001'
);
```

### Example 2: Error - Different Rounds
```sql
-- This should fail with "Matches must be in the same round"
SELECT swap_bracket_positions_atomic(
  'tournament-uuid'::uuid,
  'user-uuid'::uuid,
  'round1-match-uuid'::uuid,  -- Round 1
  'round2-match-uuid'::uuid,  -- Round 2
  'couple1_id',
  'couple1_id',
  'swap_test_002'
);
```

### Example 3: Error - Empty Slot
```sql
-- This should fail with "Source slot is empty"  
SELECT swap_bracket_positions_atomic(
  'tournament-uuid'::uuid,
  'user-uuid'::uuid,
  'empty-slot-match-uuid'::uuid,  -- Has NULL couple1_id
  'occupied-match-uuid'::uuid,
  'couple1_id',  -- This slot is empty
  'couple1_id',
  'swap_test_003'
);
```

## 📊 Performance Characteristics

### Expected Latency
- **Simple swaps**: < 50ms
- **Cross-match swaps**: < 100ms  
- **With bracket position updates**: < 150ms

### Throughput
- Supports concurrent operations on different matches
- Row-level locking prevents global bottlenecks
- Indexed lookups on all primary keys

### Lock Duration
- Microseconds for simple position swaps
- Minimal contention due to specific match targeting
- Automatic lock release on transaction completion

## 🔍 Debugging & Monitoring

### Operation Tracing
Use `operation_id` to trace operations:
1. Frontend drag & drop event
2. API route processing  
3. RPC function execution
4. Audit log entry
5. Database state changes

### Common Error Patterns
- **PGRST202**: Function signature mismatch
- **P0001**: Business logic validation failure  
- **42P01**: Table/column not found (schema issues)
- **23505**: Unique constraint violation

### Monitoring Queries
```sql
-- Recent swap operations
SELECT * FROM audit_logs 
WHERE operation LIKE 'swap%' 
ORDER BY created_at DESC 
LIMIT 20;

-- Failed operations by error type
SELECT metadata->>'error_code', COUNT(*) 
FROM audit_logs 
WHERE operation = 'swap_positions_error'
GROUP BY metadata->>'error_code';

-- Performance metrics
SELECT 
  operation,
  AVG(EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (ORDER BY created_at)))) as avg_duration_seconds
FROM audit_logs 
WHERE table_name = 'matches'
GROUP BY operation;
```

## 🚀 Future Enhancements

### Planned Improvements
1. **Batch Operations**: Process multiple swaps in single RPC call
2. **Undo Functionality**: Reverse swap operations  
3. **Conflict Resolution**: Handle simultaneous modifications
4. **Performance Metrics**: Built-in timing and statistics

### Migration Path
- All functions designed to be backwards compatible
- Existing `swap_bracket_positions` function remains functional
- New functions extend capabilities without breaking changes
- Audit logs maintain operation history across versions

---

## 📝 Function Dependencies

### Required Tables
- `matches` - Core match data
- `tournaments` - Tournament information
- `user_details_v` - User permission validation
- `tournament_couple_seeds` - Bracket seeding (optional)
- `match_hierarchy` - Match relationships (for COUPLE_TO_EMPTY)
- `audit_logs` - Operation tracking

### Required Permissions  
- `authenticated` role must have `EXECUTE` on all functions
- Functions use `SECURITY DEFINER` for elevated privileges
- Database user must have INSERT/UPDATE on all affected tables

### Schema Requirements
- All UUID columns must be properly indexed
- Foreign key constraints must be properly defined
- Audit logs table must exist with proper structure