import { Logger } from "../utils/logger";
import * as sqlite3 from "sqlite3";

const log = new Logger("DB");

export abstract class Repository<T> {

    static open(path: string): Promise<sqlite3.Database> {
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

    static run(db: sqlite3.Database, sql: string): Promise<sqlite3.RunResult> {
        return new Promise<sqlite3.RunResult>((resolve, reject) => {
            log.debug(() => `Directly executing: ${sql}`);
            db.run(sql, function (err) {
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

    protected _dataColumn: string;
    protected _list: sqlite3.Statement;
    protected _get: sqlite3.Statement;
    protected _insert: sqlite3.Statement;
    protected _update: sqlite3.Statement;
    protected _delete: sqlite3.Statement;

    constructor(private readonly _db: sqlite3.Database) {

    }

    protected prepare(sql: string): Promise<sqlite3.Statement> {
        return new Promise<sqlite3.Statement>((resolve, reject) => {
            log.debug(() => `Preparing: ${sql}`);
            this._db.prepare(sql, function (err: Error) {
                if (err) {
                    log.error(`Failed to prepare statement: ${err.message}`);
                    log.error(`Statement: ${sql}`);
                    reject(err);
                }
                else {
                    resolve(this);
                }
            });
        });
    }

    protected async _init(): Promise<void> {
        await this._prepareStatements();
        if (!this._dataColumn) throw new Error("Data column name not set");
        if (!this._list) throw new Error("List statement not prepared");
        if (!this._get) throw new Error("Get statement not prepared");
        if (!this._insert) throw new Error("Insert statement not prepared");
        if (!this._update) throw new Error("Update statement not prepared");
        if (!this._delete) throw new Error("Delete statement not prepared");
    }

    private _finalize(statement: sqlite3.Statement): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            statement.finalize((err) => {
                if (err) {
                    log.error(`Failed to finalize statement: ${err.message}`);
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }

    abstract _prepareStatements(): Promise<void>;

    async release() {
        await this._finalize(this._list);
        await this._finalize(this._insert);
        await this._finalize(this._get);
        await this._finalize(this._update);
        await this._finalize(this._delete);
    }

    list(): Promise<T[]> {
        return new Promise<T[]>((resolve, reject) => {
            const results: T[] = [];
            this._list.each((err, row) => {
                if (err) {
                    log.error(`List failed: ${err.message}`);
                    reject(err);
                }
                else {
                    const item = JSON.parse(row[this._dataColumn]);
                    item.id = row.id;
                    results.push(item);
                }
            }, (err, count) => {
                if (err) {
                    log.error(`List failed: ${err.message}`);
                    reject(err);
                }
                else {
                    resolve(results);
                }
            });
        });
    }

    insert(item: T): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const data = JSON.stringify(item);
            this._insert.run(data, function (err) {
                if (err) {
                    log.error(`Failed to insert item: ${err.message}`);
                    log.error(`Item: ${data}`);
                    reject(err);
                }
                else {
                    item["id"] = this.lastID;
                    resolve();
                }
            });
        });
    }

    get(id: number): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this._get.get(id, (err, row) => {
                if (err) {
                    log.error(`Failed to get item ${id}: ${err.message}`);
                    reject(err);
                }
                else {
                    const item = JSON.parse(row[this._dataColumn]);
                    item["id"] = id;
                    resolve(item);
                }
            });
        });
    }

    update(item: T): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const data = JSON.stringify(item);
            this._update.run(data, item["id"], (err: Error) => {
                if (err) {
                    log.error(`Failed to update item ${item["id"]}: ${err.message}`);
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }

    delete(id: number): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._delete.run(id, (err) => {
                if (err) {
                    log.error(`Failed to delete item ${id}: ${err.message}`);
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }
}