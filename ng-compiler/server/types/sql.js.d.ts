declare module 'sql.js' {
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }

  interface Database {
    run(sql: string, params?: any[]): Database;
    exec(sql: string): QueryExecResult[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  interface Statement {
    bind(params?: any[]): boolean;
    step(): boolean;
    getAsObject(params?: object): Record<string, any>;
    free(): boolean;
    reset(): void;
  }

  interface QueryExecResult {
    columns: string[];
    values: any[][];
  }

  export default function initSqlJs(config?: object): Promise<SqlJsStatic>;
  export { Database, Statement, SqlJsStatic, QueryExecResult };
}
