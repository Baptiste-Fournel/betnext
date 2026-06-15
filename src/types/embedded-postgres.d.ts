declare module 'embedded-postgres' {
  interface EmbeddedPostgresOptions {
    databaseDir: string;
    user?: string;
    password?: string;
    port?: number;
    persistent?: boolean;
  }
  export default class EmbeddedPostgres {
    constructor(options: EmbeddedPostgresOptions);
    initialise(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    createDatabase(name: string): Promise<void>;
  }
}
