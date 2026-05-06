# 🔄 Swap Bracket Positions API

## 📋 Overview

This API endpoint provides **atomic bracket position swapping** functionality for tournament management. The implementation solves race condition issues that occurred with concurrent swap operations.

## 🚨 Problem Solved

### **Previous Issue: Race Conditions**
- Multiple users swapping positions simultaneously caused inconsistent data
- Validation based on stale data led to intermittent failures (400 BAD REQUEST)
- Audit logs were sometimes incomplete due to failed transactions

### **Solution: Atomic RPC Function**
- All validations and operations in single database transaction
- `FOR UPDATE` locks prevent concurrent access to same matches
- Complete rollback on any validation failure
- Comprehensive error reporting with operation tracing

## 🏗️ Architecture

```
Frontend Request
       ↓
API Route (Basic validation + Auth)
       ↓
RPC Function (All business logic + swap)
       ↓
Database (Atomic transaction)
```

## 🔧 API Specification

### **Endpoint**
```
POST /api/tournaments/[id]/swap-bracket-positions
```

### **Request Body**
```typescript
{
  sourceMatchId: string      // UUID of source match
  targetMatchId: string      // UUID of target match  
  sourceSlot: 'couple1_id' | 'couple2_id'
  targetSlot: 'couple1_id' | 'couple2_id'
  operationId: string        // Unique operation identifier
}
```

### **Success Response (200)**
```typescript
{
  success: true,
  operationId: string,
  details: {
    swapped_couples: {
      source: string,      // UUID of couple moved from source
      target: string       // UUID of couple moved from target
    },
    bracket_positions_updated: boolean,
    source_match_id: string,
    target_match_id: string
  }
}
```

### **Error Responses**

#### **400 - Validation Error**
```typescript
{
  success: false,
  operationId: string,
  error: string,           // Human-readable error message
  details?: object         // Additional context (optional)
}
```

**Common validation errors:**
- `"Missing required fields"`
- `"Invalid slot format"`
- `"Matches must be in the same round"`
- `"Cannot move couples from/to matches that are not pending"`
- `"Both positions must have couples to swap"`
- `"Cannot move couple to the same position"`

#### **401 - Unauthorized**
```typescript
{
  success: false,
  operationId: string,
  error: "Unauthorized"
}
```

#### **403 - Insufficient Permissions**
```typescript
{
  success: false,
  operationId: string,
  error: "Insufficient permissions - user must belong to tournament club"
}
```

#### **404 - Not Found**
```typescript
{
  success: false,
  operationId: string,
  error: "Matches not found or not in tournament"
}
```

#### **500 - Internal Error**
```typescript
{
  success: false,
  operationId: string,
  error: "Database operation failed",
  details?: string
}
```

## 🔒 Security & Validation

### **Authentication**
- User must be authenticated via Supabase Auth
- JWT token validated for each request

### **Authorization**
- User must belong to the same club as the tournament
- Verified through `user_details_v` and `tournaments` tables

### **Business Logic Validation**
All validations performed atomically in RPC function:

1. **Match Existence**: Both matches exist and belong to tournament
2. **User Permissions**: User club matches tournament club
3. **Same Round**: Source and target matches in same tournament round
4. **Match Status**: Both matches must be PENDING status
5. **Position Validity**: Both positions must contain couples (no NULL values)
6. **No Self-Swap**: Cannot move couple to same position

### **Race Condition Prevention**
- `SELECT ... FOR UPDATE` locks acquired on both matches
- All operations within single transaction
- Automatic rollback on any failure

## 🗃️ Database Operations

### **Tables Modified**
- `matches` - Couple position updates
- `tournament_couple_seeds` - Bracket position synchronization (if exists)
- `audit_logs` - Operation tracking

### **RPC Function: `swap_bracket_positions_atomic`**
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

## 📊 Performance

### **Optimization Features**
- Single RPC call (reduced network round-trips)
- Row-level locking (minimal lock contention)
- Indexed lookups (tournament_id, match_id, user_id)
- Conditional bracket position updates (only when needed)

### **Expected Performance**
- **Latency**: < 50ms for successful operations
- **Throughput**: Supports concurrent operations on different matches
- **Lock Duration**: Minimal (microseconds for simple swaps)

## 🔍 Monitoring & Debugging

### **Audit Trail**
Every successful operation logged in `audit_logs` with:
- Operation ID for tracing
- User and tournament context
- Before/after couple positions
- Bracket position changes
- Timestamp information

### **Error Logging**
- API route logs errors with operation context
- RPC function returns detailed error information
- Console logging for debugging in development

### **Operation Tracing**
Use `operationId` to trace operations across:
- Frontend drag & drop events
- API route processing
- RPC function execution
- Audit log entries

## 🧪 Testing

### **Test Scenarios**
1. **Normal Swap**: Two couples in different matches
2. **Same Match Swap**: Couple positions within same match
3. **Race Condition**: Simultaneous swaps on same matches
4. **Permission Denial**: User from different club
5. **Invalid Status**: Matches not in PENDING status
6. **Missing Couples**: NULL positions in matches

### **Frontend Integration**
The API is designed to work with:
- `useBracketDragDrop` hook
- React drag & drop operations
- Optimistic UI updates with rollback capability

## 🔄 Migration Notes

### **Breaking Changes**
- **RPC Function**: New `swap_bracket_positions_atomic` replaces `swap_bracket_positions`
- **Response Format**: Simplified and standardized error responses
- **Validation Logic**: Moved from API route to database function

### **Backward Compatibility**
- **Frontend**: No changes required (same API contract)
- **Operation ID**: Still used for tracing and deduplication
- **Error Handling**: Improved with more specific status codes

## 🚀 Future Enhancements

### **Possible Improvements**
1. **Batch Swaps**: Multiple position swaps in single operation
2. **Placeholder Support**: Swapping with placeholder positions
3. **Undo Operations**: Reverse swap capability
4. **Conflict Resolution**: Advanced handling of concurrent modifications

### **Monitoring Integration**
- Add metrics for swap frequency and success rates
- Performance monitoring for lock contention
- Alert on validation failure patterns

---

## 📝 Example Usage

```typescript
// Frontend call example
const response = await fetch(`/api/tournaments/${tournamentId}/swap-bracket-positions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sourceMatchId: 'a7b4f441-233c-4573-bcb4-846041c01ac4',
    targetMatchId: 'd0f12167-b98b-46b9-a2ad-16c6e32fe251',
    sourceSlot: 'couple1_id',
    targetSlot: 'couple2_id',
    operationId: 'swap_1756578948910_bzt7opnmi'
  })
})

const result = await response.json()
if (result.success) {
  console.log('Swap completed:', result.details)
} else {
  console.error('Swap failed:', result.error)
}
```
