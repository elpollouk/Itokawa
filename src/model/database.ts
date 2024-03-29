import { Logger } from "../utils/logger";
import * as sqlite3 from "sqlite3";
import * as fs from "fs";
import { Repository } from "./repository";
import { Statement } from "./statement";
import { LocoView } from "./locoview";

const log = new Logger("Database");

const SCHEMA_VERSION_KEY = "schemaVersion";
const SCHEMA_VERSION = 3;

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
        const db = new Database();
        await db._init(path);
        return db;
    }

    private _db: sqlite3.Database;
    private _repositories: Map<RepositoryConstructable<unknown, Repository<unknown>>, Repository<unknown>>;
    private _locoViews: Map<string, LocoView>;
    private _schemaVersion: number;

    get schemaVersion() {
        return this._schemaVersion;
    }

    get sqlite3() {
        return this._db;
    }

    private constructor() {
        this._repositories = new Map();
        this._locoViews = new Map();
    }

    private async _init(filename: string) {
        this._db = await _open(filename);

        try {
            // Foreign keys aren't enabled by default, but we do want to enforce their contraints, so turn them on
            await this.run("PRAGMA foreign_keys = ON;");

            // We want to explicitly create this table so that we have the store available before running
            // any schema scripts.
            await this.run(`
                CREATE TABLE IF NOT EXISTS _kv_store (key VARCHAR PRIMARY KEY, value ANY);
            `);

            const schemaVersion = await this.getValue(SCHEMA_VERSION_KEY, 0) as number;
            log.debug(() => `Opening DB with schema ${schemaVersion}`);

            if (SCHEMA_VERSION < schemaVersion) throw new Error("Database schema version higher than supported");

            if (schemaVersion < SCHEMA_VERSION) {
                // The database needs the latest schema scripts applied
                await this._runSchemaScripts(schemaVersion);
            }
            else {
                this._schemaVersion = schemaVersion;
            }

            await LocoView.init(this);
        }
        catch (ex)
        {
            await this.close();
            throw ex;
        }
    }

    private async _runSchemaScripts(currentSchemaVersion: number) {
        let scripts = fs.readdirSync("./schema");
        scripts = scripts.filter((entry) => entry.endsWith(".sql"));
        scripts = scripts.sort((a, b) => a.localeCompare(b, "en-GB"));

        if (scripts.length === 0) throw new Error("No schema scripts found");

        for (const script of scripts) {
            // Scripts have names such as "0024 - Add Life.sql". We just want the leading digits
            const schemaNum = Number(script.match(/^\d+/)[0]);
            // Skip over any schema scripts that should have already been applied
            if (schemaNum <= currentSchemaVersion) continue;

            log.info(() => `Running schema script '${script}'...`);
            const content = fs.readFileSync(`./schema/${script}`, {
                encoding: "utf8"
            });
            await this.exec(content);
        }

        // Clean up the database while we're here
        await this.exec("VACUUM;");

        this.setValue(SCHEMA_VERSION_KEY, SCHEMA_VERSION);
        log.info(() => `Upgraded from schema version ${currentSchemaVersion} to ${SCHEMA_VERSION}`);
        this._schemaVersion = SCHEMA_VERSION;
    }

    async close(): Promise<void> {
        for (const repo of this._repositories.values())
            await repo.release();
        this._repositories.clear();

        this._locoViews.clear();
        await LocoView.release();

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

    async getValue(key: string, defaultValue?: string | number | boolean): Promise<string | number | boolean> {
        const pair = await this.get(`
            SELECT value from _kv_store
            WHERE key = $key
        `, {
            $key: key
        });
        if (pair)
            return pair.value;
        else
            return defaultValue;
    }

    exec(sql: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            log.debug(() => `Directly executing: ${sql}`);
            this._db.exec(sql, function (err) {
                if (err) {
                    log.error(`Execution failed: ${err.message}`);
                    log.error(`Statement: ${sql}`);
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }

    run(sql: string, params?: any): Promise<sqlite3.RunResult> {
        return new Promise<sqlite3.RunResult>((resolve, reject) => {
            log.debug(() => `Directly running: ${sql}`);
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

    all(sql: string, params?: any): Promise<any[]> {
        return new Promise<any[]>((resolve, reject) => {
            log.debug(() => `Directly executing: ${sql}`);
            this._db.all(sql, params, (err, rows) => {
                if (err) {
                    log.error(`Execution failed: ${err.message}`);
                    log.error(`Statement: ${sql}`);
                    reject(err);
                }
                else {
                    resolve(rows);
                }
            });
        });
    }

    prepare<T=any>(sql: string): Promise<Statement<T>> {
        return new Promise<Statement>((resolve, reject) => {
            this._db.prepare(sql, function (err) {
                if (err) {
                    log.error(`Failed to prepare statement: ${err.message}`);
                    log.error(`Statement: ${sql}`);
                    reject(err);
                }
                else {
                    resolve(new Statement(this));
                }
            });
        });
    }

    backup(path: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._db.serialize(() => {
                this.run("VACUUM INTO $path", {
                    $path: path
                }).then(() => resolve(), reject);
            });
        });
    }

    async openRepository<ItemType, RepositoryType extends Repository<ItemType> = Repository<ItemType>>(repoType: RepositoryConstructable<ItemType, RepositoryType>): Promise<RepositoryType> {
        let repo = this._repositories.get(repoType) as RepositoryType;
        if (repo) return repo;

        repo = new repoType(this);
        await repo.init();
        this._repositories.set(repoType, repo);

        return repo;
    }

    async openLocoView(viewName: string): Promise<LocoView> {
        let view = this._locoViews.get(viewName);
        if (view) return view;

        view = await LocoView.getView(viewName);
        this._locoViews.set(viewName, view);
        return Promise.resolve(view);
    }
}