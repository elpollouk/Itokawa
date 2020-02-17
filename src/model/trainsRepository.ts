import { Repository } from "./repository";
import { Loco } from "../common/api";
import { Database } from "sqlite3";
 
export class TrainsRepository extends Repository<Loco> {
    
    static async create(db: Database): Promise<TrainsRepository> {
        const repo = new TrainsRepository(db);
        await repo._init();
        return repo;
    }

    async _prepareStatements(): Promise<void> {
        this._dataColumn = "train";
        this._list = await this.prepare("SELECT rowid as id, train FROM trains;")
        this._get = await this.prepare("SELECT rowid as id, train FROM trains where id = ?;");
        this._insert = await this.prepare("INSERT INTO trains (train) VALUES (json(?));");
        this._update = await this.prepare("UPDATE trains SET train = json(?) WHERE rowid = ?;");
        this._delete = await this.prepare("DELETE FROM trains WHERE rowid = ?;");
    }
};