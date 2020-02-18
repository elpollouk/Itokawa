import { Logger } from "../utils/logger";
import { Database } from "./database";
import * as sqlite3 from "sqlite3";

const log = new Logger("Repository");

function _finalize(statement: sqlite3.Statement): Promise<void> {
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

export abstract class Repository<T> {
    protected _list: sqlite3.Statement;
    protected _get: sqlite3.Statement;
    protected _insert: sqlite3.Statement;
    protected _update: sqlite3.Statement;
    protected _delete: sqlite3.Statement;

    constructor(protected readonly _db: Database) {

    }

    async init(): Promise<void> {
        await this._prepareStatements();
    }

    abstract async release(): Promise<void>;

    abstract _prepareStatements(): Promise<void>;

    list(): Promise<T[]> {
        return new Promise<T[]>((resolve, reject) => {
            const results: T[] = [];
            this._list.each((err, row) => {
                if (err) {
                    log.error(`List failed: ${err.message}`);
                    reject(err);
                }
                else {
                    const item = JSON.parse(row.item);
                    item.id = row.id;
                    results.push(item);
                }
            }, (err) => {
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
            this._insert.run({
                $item: data
            }, function (err) {
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
            this._get.get({
                $id: id
            }, (err, row) => {
                if (err) {
                    log.error(`Failed to get item ${id}: ${err.message}`);
                    reject(err);
                }
                else {
                    if (!row) {
                        resolve();
                    }
                    else {
                        const data = row.item;
                        const item = JSON.parse(data);
                        item["id"] = id;
                        resolve(item);
                    }
                }
            });
        });
    }

    update(item: T): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const id = item["id"];
            const data = JSON.stringify(item);
            this._update.run({
                $id: id,
                $item: data
            }, function (err: Error) {
                if (err) {
                    log.error(`Failed to update item ${id}: ${err.message}`);
                    reject(err);
                }
                else if (this.changes != 1) {
                    reject(new Error(`Unexpected number of updates: ${this.changes}`));
                }
                else {
                    resolve();
                }
            });
        });
    }

    delete(id: number): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._delete.run({
                $id: id
            }, (err) => {
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

export class SqliteRepository<T> extends Repository<T> {   
    constructor(db: Database, private readonly _table: string, private readonly _dataColumn: string) {
        super(db);
    }

    async _finalizeAndNull(statement: string) {
        const s = this[statement];
        await _finalize(s);
        this[statement] = null;
    }

    async release() {
        if (this._list) {
            await this._finalizeAndNull("_list");
            await this._finalizeAndNull("_insert");
            await this._finalizeAndNull("_get");
            await this._finalizeAndNull("_update");
            await this._finalizeAndNull("_delete");
        }
    }

    async _prepareStatements(): Promise<void> {
        await this._db.run(`CREATE TABLE IF NOT EXISTS ${this._table} (${this._dataColumn} JSON);`);
        this._list = await this._prepare(`SELECT rowid as id, ${this._dataColumn} AS item FROM ${this._table};`);
        this._get = await this._prepare(`SELECT rowid as id, ${this._dataColumn} AS item FROM ${this._table} where id = $id;`);
        this._insert = await this._prepare(`INSERT INTO ${this._table} (${this._dataColumn}) VALUES (json($item));`);
        this._update = await this._prepare(`UPDATE ${this._table} SET ${this._dataColumn} = json($item) WHERE rowid = $id;`);
        this._delete = await this._prepare(`DELETE FROM ${this._table} WHERE rowid = $id;`);
    }

    protected _prepare(sql: string): Promise<sqlite3.Statement> {
        return new Promise<sqlite3.Statement>((resolve, reject) => {
            log.debug(() => `Preparing: ${sql}`);
            this._db.sqlite3.prepare(sql, function (err: Error) {
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
};