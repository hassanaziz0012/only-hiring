import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import {
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type CompiledQuery,
  type DatabaseConnection,
  type Dialect,
  type Driver,
  type Kysely,
  type QueryResult,
} from "kysely";

// The accounts database over Neon's HTTP API: one HTTPS request per query, nothing to open or close.
//
// The WebSocket driver (Pool) can't keep a connection from one Worker request to the next, so each request paid
// for a new connection and Postgres login: 1.5–2 s and 15–50 ms of CPU, more than the free plan's 10 ms. Over
// HTTP a query takes one round trip, and the login happens on Neon's side.
//
// HTTP queries can't hold a transaction open, so better-auth is told not to use transactions (worker/auth.ts).
// It only needs them on MySQL; on Postgres every write it makes is a single statement.

export type Db = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

/** The query function for a connection string. Cheap: it holds no connection, only the URL. */
export function neonHttp(url: string): NeonQueryFunction<false, true> {
  return neon(url, { fullResults: true });
}

export function accountsDb(url: string): Db {
  const sql = neonHttp(url);
  return {
    async query<T>(text: string, params: unknown[] = []) {
      const result = await sql.query(text, params);
      return { rows: result.rows as T[] };
    },
  };
}

class NeonHttpConnection implements DatabaseConnection {
  constructor(private sql: NeonQueryFunction<false, true>) {}

  async executeQuery<R>(compiled: CompiledQuery): Promise<QueryResult<R>> {
    const result = await this.sql.query(compiled.sql, compiled.parameters as unknown[]);
    const command = result.command;
    const affected = command === "INSERT" || command === "UPDATE" || command === "DELETE" || command === "MERGE";
    return {
      rows: result.rows as R[],
      ...(affected && result.rowCount != null && { numAffectedRows: BigInt(result.rowCount) }),
    };
  }

  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error("Streaming queries aren't supported over Neon's HTTP API.");
  }
}

class NeonHttpDriver implements Driver {
  private connection: NeonHttpConnection;

  constructor(sql: NeonQueryFunction<false, true>) {
    this.connection = new NeonHttpConnection(sql);
  }

  async init() {}
  async acquireConnection() {
    return this.connection;
  }
  async beginTransaction(): Promise<void> {
    throw new Error("Transactions aren't supported over Neon's HTTP API.");
  }
  async commitTransaction(): Promise<void> {
    throw new Error("Transactions aren't supported over Neon's HTTP API.");
  }
  async rollbackTransaction(): Promise<void> {
    throw new Error("Transactions aren't supported over Neon's HTTP API.");
  }
  async releaseConnection() {}
  async destroy() {}
}

/** A Kysely dialect for Postgres over Neon's HTTP API, for better-auth. */
export class NeonHttpDialect implements Dialect {
  constructor(private url: string) {}

  createAdapter() {
    return new PostgresAdapter();
  }
  createDriver() {
    return new NeonHttpDriver(neonHttp(this.url));
  }
  createQueryCompiler() {
    return new PostgresQueryCompiler();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createIntrospector(db: Kysely<any>) {
    return new PostgresIntrospector(db);
  }
}
