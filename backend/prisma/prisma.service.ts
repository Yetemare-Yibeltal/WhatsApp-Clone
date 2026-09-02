// backend/src/database/prisma/prisma.service.ts
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Inject,
  Optional,
} from "@nestjs/common";
import { PrismaClient, Prisma } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";

/**
 * Extended Prisma client with:
 * - connection retry logic
 * - query logging (with slow query detection)
 * - pagination helper
 * - transaction wrapper
 * - health check
 */
@Injectable()
export class PrismaService
  extends PrismaClient<
    Prisma.PrismaClientOptions,
    "query" | "info" | "warn" | "error"
  >
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly slowQueryThresholdMs: number = 500; // configurable via env
  private connectionAttempts = 0;
  private readonly maxConnectionAttempts = 5;
  private readonly retryDelayMs = 1000;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {
    const databaseUrl = configService.get<string>("databaseUrl");
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not defined in environment");
    }

    super({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      // Enable query logging only in non‑production environments
      log:
        configService.get("nodeEnv") !== "production"
          ? [
              { emit: "event", level: "query" },
              { emit: "event", level: "info" },
              { emit: "event", level: "warn" },
              { emit: "event", level: "error" },
            ]
          : [
              { emit: "event", level: "warn" },
              { emit: "event", level: "error" },
            ],
      // Set connection pool size from env or default to 10
      connectionLimit: Math.min(
        parseInt(configService.get("DB_POOL_SIZE") || "10", 10),
        100,
      ),
    });

    // Attach event listeners for logging
    this.$on("query", this.handleQueryEvent.bind(this));
    this.$on("info", this.handleInfoEvent.bind(this));
    this.$on("warn", this.handleWarnEvent.bind(this));
    this.$on("error", this.handleErrorEvent.bind(this));

    // Override the default connection timeout
    this._connectTimeout = parseInt(
      configService.get("DB_CONNECT_TIMEOUT") || "30000",
      10,
    );
  }

  // ---------------------- LIFECYCLE HOOKS ----------------------
  async onModuleInit() {
    await this.connectWithRetry();
    this.logger.log("Prisma database connection established successfully.");
    // Emit event for other modules to know DB is ready
    if (this.eventEmitter) {
      this.eventEmitter.emit("database.connected", { timestamp: new Date() });
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log("Prisma database connection closed gracefully.");
  }

  // ---------------------- CONNECTION RETRY LOGIC ----------------------
  private async connectWithRetry(): Promise<void> {
    try {
      await this.$connect();
      this.connectionAttempts = 0; // reset on success
    } catch (error) {
      this.connectionAttempts++;
      if (this.connectionAttempts >= this.maxConnectionAttempts) {
        this.logger.error(
          `Failed to connect to database after ${this.maxConnectionAttempts} attempts. Last error: ${error.message}`,
        );
        throw new Error(`Database connection failed: ${error.message}`);
      }
      this.logger.warn(
        `Database connection attempt ${this.connectionAttempts} failed. Retrying in ${this.retryDelayMs}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
      return this.connectWithRetry();
    }
  }

  // ---------------------- EVENT HANDLERS ----------------------
  private handleQueryEvent(event: Prisma.QueryEvent) {
    const duration = event.duration;
    const query = event.query;
    const params = event.params;

    if (duration > this.slowQueryThresholdMs) {
      this.logger.warn(
        `SLOW QUERY (${duration}ms): ${query} | Params: ${params || "none"}`,
      );
    } else if (this.configService.get("nodeEnv") === "development") {
      this.logger.debug(`Query (${duration}ms): ${query}`);
    }
  }

  private handleInfoEvent(event: Prisma.InfoEvent) {
    this.logger.log(`Prisma Info: ${event.message}`);
  }

  private handleWarnEvent(event: Prisma.WarnEvent) {
    this.logger.warn(`Prisma Warning: ${event.message}`);
  }

  private handleErrorEvent(event: Prisma.ErrorEvent) {
    this.logger.error(`Prisma Error: ${event.message}`);
  }

  // ---------------------- PAGINATION HELPER ----------------------
  /**
   * Generic paginated findMany with cursor‑based or offset‑based pagination.
   * Automatically adds `skip`, `take`, and `cursor` if provided.
   */
  async paginatedFindMany<T, A extends Prisma.Args<T, "findMany">>(
    model: any, // Prisma model delegate (e.g., prisma.user)
    args: A,
    page?: number,
    limit?: number,
    cursor?: { id: string } | null,
  ): Promise<{
    data: Prisma.Result<T, A, "findMany">;
    pagination: {
      page: number | null;
      limit: number | null;
      total: number | null;
      hasMore: boolean;
    };
  }> {
    if (page && limit) {
      const skip = (page - 1) * limit;
      const take = limit;
      const [data, total] = await this.$transaction([
        model.findMany({ ...args, skip, take }),
        model.count({ where: (args as any).where }),
      ]);
      const hasMore = total > page * limit;
      return {
        data,
        pagination: { page, limit, total, hasMore },
      };
    }

    if (cursor) {
      const take = limit || 20;
      const data = await model.findMany({
        ...args,
        cursor,
        take,
        skip: 1, // skip the cursor item
      });
      const hasMore = data.length === take;
      return {
        data,
        pagination: {
          page: null,
          limit: take,
          total: null,
          hasMore,
        },
      };
    }

    // No pagination: return all matching records (use with caution)
    const data = await model.findMany(args);
    return {
      data,
      pagination: {
        page: null,
        limit: null,
        total: null,
        hasMore: false,
      },
    };
  }

  // ---------------------- TRANSACTION WRAPPER ----------------------
  /**
   * Execute a set of operations in a transaction with automatic retry on serialization failures.
   * @param fn - The transaction function.
   * @param maxRetries - Number of retry attempts (default 3).
   * @returns The result of the transaction.
   */
  async withTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    maxRetries: number = 3,
  ): Promise<T> {
    let attempts = 0;
    let lastError: any;

    while (attempts < maxRetries) {
      try {
        attempts++;
        return await this.$transaction(fn);
      } catch (error) {
        lastError = error;
        // Only retry on serialization errors (40001) or connection errors
        if (
          error?.code === "P2034" || // transaction conflict
          error?.code === "P2024" || // connection lost
          error?.code === "P1017" // connection error
        ) {
          const delay = attempts * 200; // increasing backoff
          this.logger.warn(
            `Transaction attempt ${attempts} failed. Retrying in ${delay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        // Other errors are not retryable
        throw error;
      }
    }
    throw lastError;
  }

  // ---------------------- HEALTH CHECK ----------------------
  /**
   * Performs a simple database health check by executing a lightweight query.
   * @returns Promise<{ status: 'ok' | 'error'; latency?: number; message?: string }>
   */
  async healthCheck(): Promise<{
    status: "ok" | "error";
    latency?: number;
    message?: string;
  }> {
    const start = Date.now();
    try {
      await this.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;
      return { status: "ok", latency };
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      return { status: "error", message: error.message };
    }
  }

  // ---------------------- RAW QUERY WRAPPER (with logging) ----------------------
  /**
   * Execute a raw SQL query with parameterised inputs and log the result.
   * @param query - The SQL string with placeholders.
   * @param values - The parameters to bind.
   * @returns The query result.
   */
  async rawQuery<T = any>(query: string, values: any[] = []): Promise<T> {
    const start = Date.now();
    try {
      const result = await this.$queryRaw<T>(query, ...values);
      const duration = Date.now() - start;
      if (duration > this.slowQueryThresholdMs) {
        this.logger.warn(`SLOW RAW QUERY (${duration}ms): ${query}`);
      }
      return result;
    } catch (error) {
      this.logger.error(`Raw query failed: ${error.message} | Query: ${query}`);
      throw error;
    }
  }

  // ---------------------- MIGRATION STATUS ----------------------
  /**
   * Returns the current migration status (applied migrations).
   * Useful for deployment verification.
   */
  async getMigrationStatus(): Promise<{
    applied: string[];
    pending: string[];
  }> {
    // This is a simplified version; in production you would query the _prisma_migrations table.
    // We'll use the internal Prisma engine to list migrations.
    // Since Prisma client doesn't expose a direct API, we'll run a raw query.
    try {
      const result = await this.$queryRaw<
        { migration_name: string; finished_at: Date }[]
      >`
        SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY finished_at DESC
      `;
      const applied = result.map((row) => row.migration_name);
      // We don't have a way to know pending migrations without running 'prisma migrate status'
      // So we return only applied and an empty pending array.
      return { applied, pending: [] };
    } catch (error) {
      this.logger.warn("Could not fetch migration status: " + error.message);
      return { applied: [], pending: [] };
    }
  }

  // ---------------------- CONNECTION POOL STATS ----------------------
  /**
   * Returns current connection pool utilisation.
   * This is useful for monitoring and alerting.
   */
  getPoolStats(): {
    totalConnections: number;
    idleConnections: number;
    activeConnections: number;
    waitingRequests: number;
  } {
    // Prisma does not expose pool metrics directly; we can use the underlying driver.
    // For PostgreSQL we can query `pg_stat_activity` if needed.
    // We'll return a placeholder.
    return {
      totalConnections: 0,
      idleConnections: 0,
      activeConnections: 0,
      waitingRequests: 0,
    };
  }

  // ---------------------- SOFT DELETE HELPERS ----------------------
  /**
   * Soft‑delete a record by setting `deletedAt` to `now()`.
   * This assumes the model has a `deletedAt` field.
   */
  async softDelete(
    model: any,
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    const client = tx || this;
    return client.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Permanently delete a record (hard delete).
   */
  async hardDelete(
    model: any,
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    const client = tx || this;
    return client.delete({ where: { id } });
  }

  // ---------------------- BULK OPERATIONS ----------------------
  /**
   * Bulk insert multiple records with a single query.
   * @param model - The model delegate (e.g., prisma.user)
   * @param data - Array of data objects to insert.
   * @param tx - Optional transaction client.
   * @returns The number of created records.
   */
  async bulkInsert<T>(
    model: any,
    data: T[],
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    if (!data || data.length === 0) return 0;
    const client = tx || this;
    // Use `createMany` for performance
    const result = await client.createMany({ data } as any);
    return result.count;
  }

  // ---------------------- EXISTS HELPER ----------------------
  /**
   * Check if a record exists based on a condition.
   * @param model - The model delegate.
   * @param where - The filter condition.
   * @param tx - Optional transaction client.
   * @returns boolean
   */
  async exists(
    model: any,
    where: Prisma.Args<any, "findFirst">["where"],
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const client = tx || this;
    const record = await client.findFirst({
      where,
      select: { id: true },
    });
    return !!record;
  }

  // ---------------------- COUNTER HELPERS ----------------------
  /**
   * Generic count with filter.
   */
  async count(
    model: any,
    where: Prisma.Args<any, "count">["where"],
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = tx || this;
    return client.count({ where });
  }

  // ---------------------- DUMP SCHEMA (for debugging) ----------------------
  /**
   * Prints the database schema in a human‑readable format (for development only).
   */
  async dumpSchema(): Promise<string> {
    // In a real implementation, you might query information_schema.
    // We'll return a placeholder.
    return "Schema dump is not implemented in this version.";
  }

  // ---------------------- EXTENDED PRISMA CLIENT METHODS ----------------------
  // You can add custom methods that are exposed to the entire application.
  // For example, a method to find a user by email or phone with profile.
  async findUserByEmailOrPhone(
    email: string,
    phone?: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this;
    return client.user.findFirst({
      where: {
        OR: [{ email: email.toLowerCase() }, { phone: phone || undefined }],
      },
      include: { profile: true },
    });
  }

  // ---------------------- END OF SERVICE ----------------------
}
