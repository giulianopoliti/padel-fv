/**
 * Base Repository with common database operations and error handling
 */

import { createClient } from '@/utils/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/database.types';
import { ValidationError, NotFoundError, InternalError } from '../domain/types/common.types';

export abstract class BaseRepository {
  protected supabase: SupabaseClient<Database>;

  constructor() {
    this.initSupabase();
  }

  private async initSupabase() {
    this.supabase = await createClient();
  }

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  protected handleError(error: any, operation: string): never {
    console.error(`[${this.constructor.name}] ${operation} failed:`, error);
    
    if (error.code === 'PGRST116') {
      throw new NotFoundError(`Resource not found during ${operation}`);
    }
    
    if (error.code?.startsWith('23')) {
      throw new ValidationError(`Database constraint violation during ${operation}: ${error.message}`);
    }
    
    throw new InternalError(`Database error during ${operation}: ${error.message || 'Unknown error'}`);
  }

  // ============================================================================
  // VALIDATION HELPERS
  // ============================================================================

  protected validateUuid(id: string, fieldName: string): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(id)) {
      throw new ValidationError(`Invalid UUID format for ${fieldName}: ${id}`);
    }
  }

  protected validateRequired<T>(value: T, fieldName: string): void {
    if (value === null || value === undefined || value === '') {
      throw new ValidationError(`${fieldName} is required`);
    }
  }

  // ============================================================================
  // COMMON QUERY PATTERNS
  // ============================================================================

  protected async findById<T>(
    tableName: string, 
    id: string, 
    selectFields?: string
  ): Promise<T | null> {
    this.validateUuid(id, 'id');
    
    try {
      const { data, error } = await this.supabase
        .from(tableName)
        .select(selectFields || '*')
        .eq('id', id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw error;
      }
      
      return data as T;
    } catch (error) {
      this.handleError(error, `findById(${tableName}, ${id})`);
    }
  }

  protected async findMany<T>(
    tableName: string,
    filters: Record<string, any> = {},
    selectFields?: string,
    orderBy?: { column: string; ascending?: boolean }
  ): Promise<T[]> {
    try {
      let query = this.supabase
        .from(tableName)
        .select(selectFields || '*');
      
      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
      
      // Apply ordering
      if (orderBy) {
        query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return (data || []) as T[];
    } catch (error) {
      this.handleError(error, `findMany(${tableName})`);
    }
  }

  protected async create<T, K>(
    tableName: string,
    entity: K,
    selectFields?: string
  ): Promise<T> {
    try {
      const { data, error } = await this.supabase
        .from(tableName)
        .insert(entity as any)
        .select(selectFields || '*')
        .single();
      
      if (error) throw error;
      
      return data as T;
    } catch (error) {
      this.handleError(error, `create(${tableName})`);
    }
  }

  protected async update<T, K>(
    tableName: string,
    id: string,
    updates: Partial<K>,
    selectFields?: string
  ): Promise<T> {
    this.validateUuid(id, 'id');
    
    try {
      const { data, error } = await this.supabase
        .from(tableName)
        .update(updates as any)
        .eq('id', id)
        .select(selectFields || '*')
        .single();
      
      if (error) throw error;
      
      return data as T;
    } catch (error) {
      this.handleError(error, `update(${tableName}, ${id})`);
    }
  }

  protected async delete(tableName: string, id: string): Promise<void> {
    this.validateUuid(id, 'id');
    
    try {
      const { error } = await this.supabase
        .from(tableName)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    } catch (error) {
      this.handleError(error, `delete(${tableName}, ${id})`);
    }
  }

  // ============================================================================
  // TRANSACTION SUPPORT (for complex operations)
  // ============================================================================

  protected async executeTransaction<T>(
    operation: (client: SupabaseClient<Database>) => Promise<T>
  ): Promise<T> {
    try {
      // Supabase doesn't have explicit transactions in the JS client,
      // but we can use RPC calls for complex operations that need atomicity
      return await operation(this.supabase);
    } catch (error) {
      this.handleError(error, 'executeTransaction');
    }
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  protected mapDatabaseEntity<T extends { created_at: string }, K>(
    dbEntity: T
  ): K & { createdAt: Date } {
    const { created_at, ...rest } = dbEntity;
    
    return {
      ...rest,
      createdAt: new Date(created_at)
    } as K & { createdAt: Date };
  }

  protected mapToDatabaseEntity<T extends { createdAt: Date }>(
    domainEntity: T
  ): Omit<T, 'createdAt'> & { created_at: string } {
    const { createdAt, ...rest } = domainEntity;
    
    return {
      ...rest,
      created_at: createdAt.toISOString()
    } as Omit<T, 'createdAt'> & { created_at: string };
  }
}