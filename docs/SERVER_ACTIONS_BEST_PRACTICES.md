# Server Actions Best Practices

## 🚨 Critical: Serialization Requirements

When creating server actions that are called from client components, **ALL return values must be serializable**. React's Server Components use "flight serialization" to pass data between server and client.

### ❌ What Causes Serialization Errors

```typescript
// These will cause "Only plain objects can be passed to Client Components" errors:

// 1. Map objects
const opponentMap = new Map<string, Set<string>>()
return { data: opponentMap }

// 2. Set objects  
const uniqueIds = new Set(['a', 'b', 'c'])
return { data: uniqueIds }

// 3. Objects with null prototype
const obj = Object.create(null)
return { data: obj }

// 4. Class instances
class CustomClass { constructor() {} }
return { data: new CustomClass() }

// 5. Functions
return { handler: () => console.log('test') }

// 6. Date objects (must be converted to strings)
return { createdAt: new Date() }
```

### ✅ Correct Approach

**Always use `createApiResponse()` for server action returns:**

```typescript
import { createApiResponse } from '@/utils/serialization'

export async function myServerAction(): Promise<{
  success: boolean
  data?: any
  error?: string
}> {
  try {
    // Your logic here...
    const result = { success: true, data: someData }
    
    // ✅ Always wrap with createApiResponse
    return createApiResponse(result)
    
  } catch (error: any) {
    // ✅ Error responses too
    return createApiResponse({ 
      success: false, 
      error: error.message 
    })
  }
}
```

## 📋 Checklist for New Server Actions

- [ ] Import `createApiResponse` from `@/utils/serialization`
- [ ] Wrap ALL return statements with `createApiResponse()`
- [ ] Convert any Date objects to ISO strings
- [ ] Ensure no Map/Set objects in return data
- [ ] Test with `JSON.stringify(result)` to catch issues early

## 🔧 The `createApiResponse` Function

This utility function:
1. **Deep clones** objects using `JSON.parse(JSON.stringify())`
2. **Removes non-plain prototypes** (Maps, Sets, etc.)
3. **Converts dates** to ISO strings
4. **Ensures serializable** data structure

```typescript
// utils/serialization.ts
export function createApiResponse<T>(data: T): T {
  // First convert dates to strings
  const datesSerialized = serializeDates(data)
  // Then ensure plain objects
  return ensureSerializable(datesSerialized)
}
```

## 🧪 Testing Serialization

Add this test to catch serialization issues early:

```typescript
// In your server action, before returning:
const result = { success: true, data: someData }

// Test serialization (remove in production)
try {
  JSON.stringify(result)
} catch (error) {
  console.error('❌ Serialization test failed:', error)
  throw new Error('Server action returns non-serializable data')
}

return createApiResponse(result)
```

## 📚 Common Patterns

### 1. Success Response
```typescript
return createApiResponse({
  success: true,
  message: 'Operation completed',
  data: resultData
})
```

### 2. Error Response  
```typescript
return createApiResponse({
  success: false,
  error: error.message,
  code: 'VALIDATION_ERROR'
})
```

### 3. Paginated Response
```typescript
return createApiResponse({
  success: true,
  data: items,
  pagination: {
    page: 1,
    limit: 10,
    total: 100
  }
})
```

## 🚀 Migration Guide

If you have existing server actions without `createApiResponse`:

1. **Find all server actions** in your codebase
2. **Add import**: `import { createApiResponse } from '@/utils/serialization'`
3. **Wrap all returns**: `return createApiResponse(originalReturn)`
4. **Test thoroughly** to ensure no breaking changes

## ⚠️ Important Notes

- **Server actions** are marked with `'use server'` at the top
- **Client components** call server actions directly
- **Route handlers** (`route.ts`) don't need this - they use different serialization
- **Always test** with actual client component calls

## 🔍 Debugging Serialization Errors

If you still get serialization errors:

1. **Check the exact error message** - it tells you which object failed
2. **Add console.log** before return to inspect the data structure
3. **Use browser dev tools** to see the full error stack
4. **Test with `JSON.stringify()`** to identify the problematic object

```typescript
// Debug helper
function debugSerialization(data: any) {
  try {
    JSON.stringify(data)
    console.log('✅ Data is serializable')
  } catch (error) {
    console.error('❌ Serialization failed:', error)
    console.log('Problematic data:', data)
  }
}
```

---

**Remember**: When in doubt, always use `createApiResponse()` for server action returns! 