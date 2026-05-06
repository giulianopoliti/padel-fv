/**
 * Utility functions for ensuring proper data serialization between Server and Client Components
 * This prevents "Only plain objects can be passed to Client Components" errors
 */

/**
 * Deeply serializes an object to ensure it contains only plain objects
 * that can be safely passed from Server Components to Client Components
 */
export function ensureSerializable<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  
  // Use JSON.parse(JSON.stringify()) to deeply clone and remove non-plain prototypes
  return JSON.parse(JSON.stringify(data));
}

/**
 * Converts dates to ISO strings for safe serialization
 */
export function serializeDates(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(serializeDates);
  }
  
  if (typeof obj === 'object') {
    const serialized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      serialized[key] = serializeDates(value);
    }
    return serialized;
  }
  
  return obj;
}

/**
 * Complete serialization function that handles dates AND ensures plain objects
 */
export function serialize<T>(data: T): T {
  // First convert dates to strings
  const datesSerialized = serializeDates(data);
  // Then ensure plain objects
  return ensureSerializable(datesSerialized);
}

/**
 * Wrapper for API responses to ensure they're always serializable
 */
export function createApiResponse<T>(data: T) {
  return serialize(data);
}