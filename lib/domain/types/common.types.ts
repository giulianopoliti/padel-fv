/**
 * Common types shared across the tournament system
 */

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  meta?: ResponseMeta;
}

export interface ResponseMeta {
  count?: number;
  page?: number;
  pageSize?: number;
  timestamp: string;
}

// ============================================================================
// ERROR HANDLING TYPES
// ============================================================================

export abstract class BaseError extends Error {
  abstract code: string;
  abstract statusCode: number;
  
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends BaseError {
  code = 'VALIDATION_ERROR';
  statusCode = 400;
}

export class NotFoundError extends BaseError {
  code = 'NOT_FOUND';
  statusCode = 404;
}

export class ConflictError extends BaseError {
  code = 'CONFLICT';
  statusCode = 409;
}

export class InternalError extends BaseError {
  code = 'INTERNAL_ERROR';
  statusCode = 500;
}

// ============================================================================
// PAGINATION TYPES
// ============================================================================

export interface PaginationOptions {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// ============================================================================
// DATABASE TYPES MAPPING
// ============================================================================

export interface DatabaseEntity {
  id: string;
  created_at: string;
  updated_at?: string;
}

// Type helpers for converting between database and domain entities
export type ToDomainEntity<T extends DatabaseEntity> = Omit<T, 'created_at' | 'updated_at'> & {
  createdAt: Date;
  updatedAt?: Date;
};

export type ToDatabase<T> = Omit<T, 'createdAt' | 'updatedAt'> & {
  created_at: string;
  updated_at?: string;
};