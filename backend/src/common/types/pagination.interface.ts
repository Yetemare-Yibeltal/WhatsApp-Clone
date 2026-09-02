// backend/src/common/types/pagination.interface.ts
/**
 * 📄 Pagination Interfaces
 *
 * This file defines all pagination-related types used across the Real WhatsApp Clone API.
 * These types support both offset-based (page/limit) and cursor-based pagination,
 * with comprehensive filtering and sorting options.
 *
 * @category Types
 * @module Pagination
 */

// -------- ENUMS --------

/**
 * Sort order direction.
 */
export enum SortOrder {
  ASC = "asc",
  DESC = "desc",
}

/**
 * Filter operator types.
 */
export enum FilterOperator {
  EQUALS = "eq",
  NOT_EQUALS = "ne",
  CONTAINS = "contains",
  NOT_CONTAINS = "notContains",
  STARTS_WITH = "startsWith",
  ENDS_WITH = "endsWith",
  IN = "in",
  NOT_IN = "notIn",
  BETWEEN = "between",
  GT = "gt",
  GTE = "gte",
  LT = "lt",
  LTE = "lte",
  IS_NULL = "isNull",
  IS_NOT_NULL = "isNotNull",
  IS_EMPTY = "isEmpty",
  IS_NOT_EMPTY = "isNotEmpty",
  REGEX = "regex",
}

/**
 * Filter logical operators.
 */
export enum FilterLogic {
  AND = "AND",
  OR = "OR",
  NOT = "NOT",
}

// -------- BASE PAGINATION INTERFACES --------

/**
 * Base pagination request parameters.
 */
export interface BasePaginationRequest {
  /** Page number (1-indexed) */
  page?: number;
  /** Number of items per page */
  limit?: number;
  /** Offset (number of items to skip) */
  offset?: number;
  /** Cursor for cursor-based pagination */
  cursor?: string;
  /** Sort field and direction */
  sort?: SortField | SortField[];
  /** Filter conditions */
  filter?: FilterGroup;
  /** Search query (simple text search) */
  search?: string;
  /** Fields to include in the response */
  fields?: string[];
  /** Whether to include total count */
  includeTotal?: boolean;
}

/**
 * Sort field definition.
 */
export interface SortField {
  field: string;
  order: SortOrder;
}

/**
 * Filter condition for a single field.
 */
export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value?: any;
}

/**
 * Filter group combining multiple conditions.
 */
export interface FilterGroup {
  logic: FilterLogic;
  conditions: (FilterCondition | FilterGroup)[];
}

/**
 * Base paginated response.
 */
export interface BasePaginationResponse<T = any> {
  /** Array of items */
  data: T[];
  /** Pagination metadata */
  pagination: {
    /** Current page number */
    page?: number;
    /** Items per page */
    limit?: number;
    /** Total number of items (if requested) */
    total?: number;
    /** Total number of pages (if page and total are available) */
    totalPages?: number;
    /** Next page cursor (for cursor-based pagination) */
    nextCursor?: string;
    /** Previous page cursor (for cursor-based pagination) */
    prevCursor?: string;
    /** Whether there are more items */
    hasMore?: boolean;
    /** Current cursor (for cursor-based pagination) */
    cursor?: string;
    /** Number of items returned */
    count?: number;
  };
  /** Query metadata (filters, sorts, etc.) */
  meta?: {
    filters?: FilterGroup;
    sort?: SortField[];
    search?: string;
    fields?: string[];
    queryDuration?: number;
  };
}

// -------- STANDARD PAGINATION (OFFSET-BASED) --------

/**
 * Standard pagination request (page/limit).
 */
export interface PageRequest extends BasePaginationRequest {
  page: number;
  limit: number;
  offset?: never;
  cursor?: never;
}

/**
 * Standard pagination response.
 */
export interface PageResponse<T = any> extends BasePaginationResponse<T> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// -------- CURSOR-BASED PAGINATION --------

/**
 * Cursor-based pagination request.
 */
export interface CursorRequest extends BasePaginationRequest {
  cursor: string;
  limit: number;
  page?: never;
  offset?: never;
}

/**
 * Cursor-based pagination response.
 */
export interface CursorResponse<T = any> extends BasePaginationResponse<T> {
  pagination: {
    limit: number;
    nextCursor?: string;
    prevCursor?: string;
    hasMore: boolean;
    count: number;
  };
}

// -------- OFFSET-BASED PAGINATION (for legacy/compatibility) --------

/**
 * Offset-based pagination request.
 */
export interface OffsetRequest extends BasePaginationRequest {
  offset: number;
  limit: number;
  page?: never;
  cursor?: never;
}

// -------- FILTER TYPES --------

/**
 * Simple filter for a single field.
 */
export interface SimpleFilter {
  field: string;
  value: any;
  operator?: FilterOperator;
}

/**
 * Range filter (for numbers, dates).
 */
export interface RangeFilter {
  field: string;
  from?: any;
  to?: any;
  includeFrom?: boolean;
  includeTo?: boolean;
}

/**
 * Array filter (in/not in).
 */
export interface ArrayFilter {
  field: string;
  values: any[];
  notIn?: boolean;
}

/**
 * Text filter (contains, startsWith, endsWith).
 */
export interface TextFilter {
  field: string;
  value: string;
  caseSensitive?: boolean;
  matchWholeWord?: boolean;
}

/**
 * Date filter.
 */
export interface DateFilter {
  field: string;
  from?: Date | string;
  to?: Date | string;
  includeFrom?: boolean;
  includeTo?: boolean;
}

/**
 * Boolean filter.
 */
export interface BooleanFilter {
  field: string;
  value: boolean;
}

/**
 * Null filter.
 */
export interface NullFilter {
  field: string;
  isNull: boolean;
}

// -------- SORT TYPES --------

/**
 * Sort configuration.
 */
export interface SortConfig {
  field: string;
  order: SortOrder;
  nullsFirst?: boolean;
  nullsLast?: boolean;
}

/**
 * Multi-field sort.
 */
export interface MultiSortConfig {
  sorts: SortConfig[];
}

// -------- PAGINATION BUILDER TYPES --------

/**
 * Options for building pagination queries.
 */
export interface PaginationBuilderOptions {
  /** Default limit if not provided */
  defaultLimit?: number;
  /** Maximum limit allowed */
  maxLimit?: number;
  /** Default sort field */
  defaultSort?: SortField | SortField[];
  /** Allowed sort fields (whitelist) */
  allowedSortFields?: string[];
  /** Allowed filter fields (whitelist) */
  allowedFilterFields?: string[];
  /** Whether to allow arbitrary filters */
  allowArbitraryFilters?: boolean;
  /** Whether to include total count by default */
  includeTotalByDefault?: boolean;
}

/**
 * Built pagination query for database operations.
 */
export interface PaginationQuery<T = any> {
  /** Skip (offset) */
  skip?: number;
  /** Take (limit) */
  take?: number;
  /** Cursor (for cursor-based pagination) */
  cursor?: { id: string } | string;
  /** Where conditions (for Prisma) */
  where?: T;
  /** Order by (for Prisma) */
  orderBy?: any;
  /** Include relations (for Prisma) */
  include?: any;
  /** Select fields (for Prisma) */
  select?: any;
  /** Raw SQL query (for raw queries) */
  raw?: {
    query: string;
    params: any[];
  };
}

// -------- UTILITY FUNCTIONS --------

/**
 * Pagination utility class with helper methods.
 */
export class PaginationUtils {
  /**
   * Normalize pagination parameters to standard format.
   */
  static normalizeParams(params: BasePaginationRequest): Required<
    Pick<BasePaginationRequest, "page" | "limit" | "includeTotal">
  > & {
    skip: number;
    take: number;
    isCursor: boolean;
  } {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const includeTotal = params.includeTotal !== false;

    // If cursor is provided, use cursor-based pagination
    const isCursor = !!params.cursor;

    // Calculate skip for offset-based pagination
    const skip = isCursor ? 0 : (page - 1) * limit;

    return {
      page,
      limit,
      skip,
      take: limit,
      includeTotal,
      isCursor,
    };
  }

  /**
   * Build pagination response.
   */
  static buildPaginationResponse<T>(
    data: T[],
    total: number,
    params: BasePaginationRequest,
    options: {
      page?: number;
      limit?: number;
      cursor?: string;
      hasMore?: boolean;
    } = {},
  ): BasePaginationResponse<T> {
    const limit = options.limit || params.limit || 20;
    const page = options.page || params.page || 1;
    const cursor = options.cursor || params.cursor;

    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
    const hasMore =
      options.hasMore !== undefined ? options.hasMore : page * limit < total;

    const pagination: BasePaginationResponse<T>["pagination"] = {
      limit,
      total,
      totalPages,
      hasMore,
      count: data.length,
    };

    if (page) {
      pagination.page = page;
    }

    if (cursor) {
      pagination.cursor = cursor;
      // For cursor-based, we may have next/prev cursors
      if (data.length > 0) {
        // This is simplified; in practice you'd encode the cursor
        pagination.nextCursor =
          data.length === limit
            ? `cursor:${data[data.length - 1]?.id || ""}`
            : undefined;
        pagination.prevCursor = cursor;
      }
    }

    return {
      data,
      pagination,
    };
  }

  /**
   * Build a cursor from a record.
   */
  static buildCursor<T extends Record<string, any>>(
    record: T,
    fields: string[] = ["id"],
  ): string {
    const parts = fields.map((field) => {
      const value = record[field];
      return `${field}:${encodeURIComponent(String(value))}`;
    });
    return Buffer.from(parts.join("|")).toString("base64");
  }

  /**
   * Parse a cursor into field values.
   */
  static parseCursor(cursor: string): Record<string, any> {
    try {
      const decoded = Buffer.from(cursor, "base64").toString("utf8");
      const parts = decoded.split("|");
      const result: Record<string, any> = {};
      for (const part of parts) {
        const [field, value] = part.split(":");
        if (field && value) {
          result[field] = decodeURIComponent(value);
        }
      }
      return result;
    } catch (_) {
      return {};
    }
  }

  /**
   * Build filter conditions for database queries.
   */
  static buildFilterConditions(
    filter: FilterGroup | undefined,
    allowedFields: string[] = [],
    allowArbitrary: boolean = false,
  ): Record<string, any> {
    if (!filter) return {};

    const result: Record<string, any> = {};
    const conditions = filter.conditions;

    for (const condition of conditions) {
      if ("conditions" in condition) {
        // Nested filter group
        const nested = this.buildFilterConditions(
          condition as FilterGroup,
          allowedFields,
          allowArbitrary,
        );
        Object.assign(result, nested);
      } else {
        // Single condition
        const cond = condition as FilterCondition;
        if (!allowArbitrary && !allowedFields.includes(cond.field)) {
          continue;
        }
        result[cond.field] = this.buildFilterCondition(cond);
      }
    }

    return result;
  }

  /**
   * Build a single filter condition.
   */
  static buildFilterCondition(condition: FilterCondition): any {
    const { field, operator, value } = condition;

    switch (operator) {
      case FilterOperator.EQUALS:
        return value;
      case FilterOperator.NOT_EQUALS:
        return { not: value };
      case FilterOperator.CONTAINS:
        return { contains: value };
      case FilterOperator.NOT_CONTAINS:
        return { not: { contains: value } };
      case FilterOperator.STARTS_WITH:
        return { startsWith: value };
      case FilterOperator.ENDS_WITH:
        return { endsWith: value };
      case FilterOperator.IN:
        return { in: value };
      case FilterOperator.NOT_IN:
        return { not: { in: value } };
      case FilterOperator.BETWEEN:
        return { gte: value[0], lte: value[1] };
      case FilterOperator.GT:
        return { gt: value };
      case FilterOperator.GTE:
        return { gte: value };
      case FilterOperator.LT:
        return { lt: value };
      case FilterOperator.LTE:
        return { lte: value };
      case FilterOperator.IS_NULL:
        return null;
      case FilterOperator.IS_NOT_NULL:
        return { not: null };
      case FilterOperator.IS_EMPTY:
        return "";
      case FilterOperator.IS_NOT_EMPTY:
        return { not: "" };
      case FilterOperator.REGEX:
        return { regex: value };
      default:
        return value;
    }
  }

  /**
   * Build sort order for database queries.
   */
  static buildSortOrder(
    sort: SortField | SortField[] | undefined,
    defaultSort: SortField | SortField[],
    allowedFields: string[] = [],
  ): any[] {
    const sorts = Array.isArray(sort) ? sort : sort ? [sort] : [];
    const defaultSorts = Array.isArray(defaultSort)
      ? defaultSort
      : [defaultSort];

    const allSorts = sorts.length > 0 ? sorts : defaultSorts;
    const result: any[] = [];

    for (const s of allSorts) {
      if (allowedFields.length > 0 && !allowedFields.includes(s.field)) {
        continue;
      }
      result.push({
        [s.field]: s.order === SortOrder.ASC ? "asc" : "desc",
      });
    }

    return result;
  }

  /**
   * Build search query for text search.
   */
  static buildSearchQuery(
    search: string | undefined,
    searchFields: string[],
  ): any {
    if (!search || searchFields.length === 0) return {};

    const conditions = searchFields.map((field) => ({
      [field]: { contains: search, mode: "insensitive" },
    }));

    return {
      OR: conditions,
    };
  }

  /**
   * Validate pagination parameters.
   */
  static validateParams(params: BasePaginationRequest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (params.page && params.page < 1) {
      errors.push("Page must be at least 1");
    }

    if (params.limit && (params.limit < 1 || params.limit > 1000)) {
      errors.push("Limit must be between 1 and 1000");
    }

    if (params.offset && params.offset < 0) {
      errors.push("Offset must be non-negative");
    }

    if (params.cursor && (params.page || params.offset)) {
      errors.push("Cursor cannot be used with page or offset");
    }

    if (params.search && typeof params.search !== "string") {
      errors.push("Search must be a string");
    }

    if (params.sort) {
      const sorts = Array.isArray(params.sort) ? params.sort : [params.sort];
      for (const sort of sorts) {
        if (!sort.field) {
          errors.push("Sort field is required");
        }
        if (
          sort.order &&
          ![SortOrder.ASC, SortOrder.DESC].includes(sort.order)
        ) {
          errors.push("Sort order must be asc or desc");
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get default pagination options.
   */
  static getDefaultOptions(): PaginationBuilderOptions {
    return {
      defaultLimit: 20,
      maxLimit: 100,
      defaultSort: { field: "createdAt", order: SortOrder.DESC },
      allowedSortFields: ["createdAt", "updatedAt", "id", "name"],
      allowedFilterFields: [],
      allowArbitraryFilters: false,
      includeTotalByDefault: true,
    };
  }
}

// -------- Prisma-SPECIFIC ADAPTERS --------

/**
 * Prisma pagination adapter.
 */
export class PrismaPaginationAdapter {
  /**
   * Convert pagination request to Prisma query options.
   */
  static toPrismaQuery<T = any>(
    params: BasePaginationRequest,
    options: PaginationBuilderOptions = {},
  ): PaginationQuery<T> {
    const opts = { ...PaginationUtils.getDefaultOptions(), ...options };
    const normalized = PaginationUtils.normalizeParams(params);

    const query: PaginationQuery<T> = {
      take: normalized.take,
    };

    // Handle cursor-based pagination
    if (normalized.isCursor && params.cursor) {
      const cursorFields = PaginationUtils.parseCursor(params.cursor);
      query.cursor = cursorFields;
      query.skip = 1; // Skip the cursor item
    } else {
      query.skip = normalized.skip;
    }

    // Build where conditions
    let where: any = {};

    // Search
    if (params.search) {
      const searchFields = params.fields || ["name", "email", "displayName"];
      const searchQuery = PaginationUtils.buildSearchQuery(
        params.search,
        searchFields,
      );
      where = { ...where, ...searchQuery };
    }

    // Filters
    if (params.filter) {
      const filterConditions = PaginationUtils.buildFilterConditions(
        params.filter,
        opts.allowedFilterFields,
        opts.allowArbitraryFilters,
      );
      where = { ...where, ...filterConditions };
    }

    // Exclude deleted records (soft delete)
    where = { ...where, deletedAt: null };

    query.where = where;

    // Build sort order
    if (params.sort || opts.defaultSort) {
      const sort = PaginationUtils.buildSortOrder(
        params.sort || opts.defaultSort,
        opts.defaultSort || { field: "createdAt", order: SortOrder.DESC },
        opts.allowedSortFields || [],
      );
      query.orderBy = sort;
    }

    return query;
  }

  /**
   * Convert Prisma result to paginated response.
   */
  static toPaginationResponse<T>(
    data: T[],
    total: number,
    params: BasePaginationRequest,
    options: { page?: number; limit?: number } = {},
  ): PageResponse<T> {
    const limit = options.limit || params.limit || 20;
    const page = options.page || params.page || 1;

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    };
  }

  /**
   * Build full Prisma query with pagination.
   */
  static buildFullQuery<T = any>(
    params: BasePaginationRequest,
    model: any,
    options: PaginationBuilderOptions = {},
  ): { query: any; countQuery: any } {
    const query = this.toPrismaQuery<T>(params, options);
    const countQuery = {
      where: query.where,
    };

    return { query, countQuery };
  }
}

// -------- TypeORM ADAPTER --------

/**
 * TypeORM pagination adapter.
 */
export class TypeOrmPaginationAdapter {
  /**
   * Convert pagination request to TypeORM find options.
   */
  static toTypeOrmQuery(
    params: BasePaginationRequest,
    options: PaginationBuilderOptions = {},
  ): any {
    const opts = { ...PaginationUtils.getDefaultOptions(), ...options };
    const normalized = PaginationUtils.normalizeParams(params);

    const query: any = {
      take: normalized.take,
    };

    if (normalized.isCursor && params.cursor) {
      // TypeORM doesn't natively support cursors; we use offset with cursor
      // This is a simplified implementation
      const cursorFields = PaginationUtils.parseCursor(params.cursor);
      query.skip = 0;
      // We'll handle cursor by adding a where condition
      const cursorWhere: any = {};
      for (const [field, value] of Object.entries(cursorFields)) {
        cursorWhere[field] = { $gt: value };
      }
      query.where = { ...query.where, ...cursorWhere };
    } else {
      query.skip = normalized.skip;
    }

    // Where conditions (simplified for TypeORM)
    if (params.filter) {
      // TypeORM uses different syntax; we'll convert
      // This is a simplified conversion
      const where = {};
      // ... conversion logic
      query.where = { ...query.where, ...where };
    }

    // Sort order
    if (params.sort || opts.defaultSort) {
      const sorts = Array.isArray(params.sort)
        ? params.sort
        : params.sort
          ? [params.sort]
          : [];
      const defaultSorts = Array.isArray(opts.defaultSort)
        ? opts.defaultSort
        : [opts.defaultSort];
      const allSorts = sorts.length > 0 ? sorts : defaultSorts;

      query.order = {};
      for (const s of allSorts) {
        query.order[s.field] = s.order.toUpperCase();
      }
    }

    return query;
  }
}

// -------- MONGODB ADAPTER --------

/**
 * MongoDB pagination adapter.
 */
export class MongoPaginationAdapter {
  /**
   * Convert pagination request to MongoDB query options.
   */
  static toMongoQuery(
    params: BasePaginationRequest,
    options: PaginationBuilderOptions = {},
  ): any {
    const opts = { ...PaginationUtils.getDefaultOptions(), ...options };
    const normalized = PaginationUtils.normalizeParams(params);

    const query: any = {
      limit: normalized.take,
    };

    if (normalized.isCursor && params.cursor) {
      const cursorFields = PaginationUtils.parseCursor(params.cursor);
      // MongoDB uses $gt for cursor
      const cursorFilter: any = {};
      for (const [field, value] of Object.entries(cursorFields)) {
        cursorFilter[field] = { $gt: value };
      }
      query.filter = { ...query.filter, ...cursorFilter };
    } else {
      query.skip = normalized.skip;
    }

    // Filter
    if (params.filter) {
      // Convert filter to MongoDB syntax
      const filter: any = {};
      // ... conversion logic
      query.filter = { ...query.filter, ...filter };
    }

    // Sort
    if (params.sort || opts.defaultSort) {
      const sorts = Array.isArray(params.sort)
        ? params.sort
        : params.sort
          ? [params.sort]
          : [];
      const defaultSorts = Array.isArray(opts.defaultSort)
        ? opts.defaultSort
        : [opts.defaultSort];
      const allSorts = sorts.length > 0 ? sorts : defaultSorts;

      query.sort = {};
      for (const s of allSorts) {
        query.sort[s.field] = s.order === SortOrder.ASC ? 1 : -1;
      }
    }

    return query;
  }
}

// -------- END --------
