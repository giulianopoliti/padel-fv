export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// Temporary fallback typing for environments where generated Supabase types
// are not present in the repository.
// Replace this file with the generated schema types when available.
export type Database = any
