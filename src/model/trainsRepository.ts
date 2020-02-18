import { SqliteRepository } from "./repository";
import { Loco } from "../common/api";
import { Database } from "./database";
 
export class TrainsRepository extends SqliteRepository<Loco> {
    constructor(db: Database) {
        super(db, "trains", "train");
    }
};