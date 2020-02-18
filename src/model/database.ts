import { Logger } from "../utils/logger";
import * as sqlite3 from "sqlite3";
import { Repository } from "./repository";

const log = new Logger("Database");

const SCHEMA_VERSION_KEY = "schemaVersion";
const SCHEMA_VERSION = 100;

interface RepositoryConstructable<ItemType, RepositoryType extends Repository<ItemType>> {
    new(db: Database): RepositoryType;
}

function _open(path: string): Promise<sqlite3.Database> {
    return new Promise<sqlite3.Database>((resolve, reject) => {
        log.debug(() => `Opening database ${path}...`);
        const db = new sqlite3.Database(path, (err) => {
            if (err) {
                log.error(`Failed to open ${path}: ${err.message}`);
                reject(err);
            }
            else {
                log.debug("Database opened");
                resolve(db);
            }
        })
    });
}

export class Database {
    static async open(path: string): Promise<Database> {
        const sqldb = await _open(path);
        const db = new Database(sqldb);
        await db._init();
        return db;
    }

    private _repositories: Map<RepositoryConstructable<unknown, Repository<unknown>>, Repository<unknown>>
    private _schemaVersion: number;
    get schemaVersion() {
        return this._schemaVersion;
    }

    get sqlite3() {
        return this._db;
    }

    private constructor(private readonly _db: sqlite3.Database) {
        this._repositories = new Map<RepositoryConstructable<any, Repository<any>>, Repository<any>>();
    }

    private async _init() {
        await this.run(`
            CREATE TABLE IF NOT EXISTS _kv_store (key VARCHAR PRIMARY KEY, value ANY);
        `);

        const schemaVersion = await this.getValue(SCHEMA_VERSION_KEY);
        if (!schemaVersion) {
            this.setValue(SCHEMA_VERSION_KEY, SCHEMA_VERSION);
            log.debug(() => `Setting schema version to ${SCHEMA_VERSION} for new database`);
            this._schemaVersion = SCHEMA_VERSION;
        }
        else {
            log.debug(() => `Reopening DB with schema ${schemaVersion}`);
            this._schemaVersion = schemaVersion as number;
        }
    }

    async close(): Promise<void> {
        for (const repo of this._repositories.values())
            await repo.release();

        await this._close();
    }

    private _close(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._db.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async setValue(key: string, value: string | number | boolean): Promise<void> {
        await this.run(`
            INSERT INTO _kv_store ( key, value )
            VALUES ( $key, $value )
            ON CONFLICT ( key )
            DO UPDATE SET value = $value;
        `, {
            $key: key,
            $value: value
        });
    }

    async getValue(key: string): Promise<string | number | boolean> {
        const pair = await this.get(`
            SELECT value from _kv_store
            WHERE key = $key
        `, {
            $key: key
        });
        if (pair)
            return pair.value;
    }

    run(sql: string, params?: any): Promise<sqlite3.RunResult> {
        return new Promise<sqlite3.RunResult>((resolve, reject) => {
            log.debug(() => `Directly executing: ${sql}`);
            this._db.run(sql, params, function (err) {
                if (err) {
                    log.error(`Execution failed: ${err.message}`);
                    log.error(`Statement: ${sql}`);
                    reject(err);
                }
                else {
                    resolve(this);
                }
            });
        });
    }

    get(sql: string, params?: any): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            log.debug(() => `Directly executing: ${sql}`);
            this._db.get(sql, params, (err, row) => {
                if (err) {
                    log.error(`Execution failed: ${err.message}`);
                    log.error(`Statement: ${sql}`);
                    reject(err);
                }
                else {
                    resolve(row);
                }
            });
        });
    }

    async openRepository<ItemType, RepositoryType extends Repository<ItemType> = Repository<ItemType>>(repoType: RepositoryConstructable<ItemType, RepositoryType>): Promise<RepositoryType> {
        if (this._repositories.has(repoType))
            return this._repositories.get(repoType) as RepositoryType;

        const repo = new repoType(this);
        await repo.init();
        this._repositories.set(repoType, repo);

        return repo;
    }
}