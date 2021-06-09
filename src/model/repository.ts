import { Logger } from "../utils/logger";
import { Database } from "./database";
import * as sqlite3 from "sqlite3";
import { Statement } from "./statement";

const log = new Logger("Repository");

export abstract class Repository<T> {
    protected _list: Statement<T>;
    protected _search: Statement<T>;
    protected _get: Statement<T>;
    protected _insert: Statement<number>;
    protected _update: Statement<number>;
    protected _delete: Statement<void>;

    constructor(protected readonly _db: Database) {

    }

    async init(): Promise<void> {
        await this._prepareStatements();
    }

    abstract release(): Promise<void>;

    abstract _prepareStatements(): Promise<void>;
    abstract _indexItemForSearch(item: T): string;

    list(query?: string): Promise<T[]> {
        const statement = query ? this._search : this._list;
        return statement.each({
            $query: query
        }, (row) => {
            const item = JSON.parse(row.item);
            item.id = row.id;
            return item;
        });
    }

    async insert(item: T): Promise<void> {
        const data = JSON.stringify(item);
        const lastId = await this._insert.run({
            $index: this._indexItemForSearch(item),
            $item: data
        }, (result) => result.lastID);
        item["id"] = lastId;
    }

    get(id: number): Promise<T> {
        return this._get.get({$id: id}, (row) => {
            if (!row) return null;
            const data = row.item;
            const item = JSON.parse(data);
            item["id"] = id;
            return item;
        });
    }

    async update(item: T): Promise<void> {
        const id = item["id"];
        const data = JSON.stringify(item);
        const changes = await this._update.run({
            $id: id,
            $index: this._indexItemForSearch(item),
            $item: data
        }, (result) => result.changes);
        if (changes != 1) throw new Error(`Unexpected number of updates: ${changes}`);
    }

    delete(id: number): Promise<void> {
        return this._delete.run({
            $id: id
        });
    }
}

export abstract class SqliteRepository<T> extends Repository<T> {   
    constructor(db: Database, private readonly _table: string, private readonly _dataColumn: string) {
        super(db);
    }

    async _finalizeAndNull(statement: string) {
        const s = this[statement] as Statement;
        await s.release();
        this[statement] = null;
    }

    async release() {
        if (this._list) {
            await this._finalizeAndNull("_list");
            await this._finalizeAndNull("_search");
            await this._finalizeAndNull("_insert");
            await this._finalizeAndNull("_get");
            await this._finalizeAndNull("_update");
            await this._finalizeAndNull("_delete");
        }
    }

    async _prepareStatements(): Promise<void> {
        this._list = await this._db.prepare(`
            SELECT
                id,
                ${this._dataColumn} AS item
            FROM
                ${this._table};`);

        this._search = await this._db.prepare(`
            SELECT
                ${this._table}.id AS id,
                ${this._dataColumn} AS item
            FROM
                ${this._table}
            JOIN
                ${this._table}_fts
            ON
                ${this._table}.id = ${this._table}_fts.id
            WHERE
                ${this._table}_fts MATCH $query
            ORDER BY
                rank;`);

        this._get = await this._db.prepare(`
            SELECT
                id,
                ${this._dataColumn} AS item
            FROM
                ${this._table}
            WHERE
                id = $id;`);

        this._insert = await this._db.prepare(`
            INSERT INTO ${this._table} (
                search_text,
                ${this._dataColumn}
            )
            VALUES (
                $index,
                json($item)
            );`);

        this._update = await this._db.prepare(`
            UPDATE
                ${this._table}
            SET
                search_text = $index,
                ${this._dataColumn} = json($item)
            WHERE
                id = $id;`);

        this._delete = await this._db.prepare(`
            DELETE FROM
                ${this._table}
            WHERE
                id = $id;`);
    }
};