import { SqliteRepository } from "./repository";
import { Loco } from "../common/api";
import { Database } from "./database";
 
export class LocoRepository extends SqliteRepository<Loco> {
    constructor(db: Database) {
        super(db, "locos", "data");
    }
};