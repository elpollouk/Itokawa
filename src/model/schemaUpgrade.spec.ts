import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import * as fs from "fs";

import { Database } from "./database";
import { LocoRepository } from "./locoRepository";

const SCHEMA_VERSION = 2;
const TEST_DB_FILE = ".test.sqlite3";

function cleanupTestDb() {
    if (fs.existsSync(TEST_DB_FILE)) {
        fs.unlinkSync(TEST_DB_FILE);
    }
}

function copyForTest(schema: number) {
    cleanupTestDb();
    fs.copyFileSync("testdata/old_schemas/schema_" + schema + ".sqlite3" , TEST_DB_FILE);
}

describe("Schema Upgrades", () => {
    let _db: Database = null;

    async function verifyDb(fromSchema: number) {
        copyForTest(fromSchema);

        _db = await Database.open(TEST_DB_FILE);
        expect(_db.schemaVersion).to.eql(SCHEMA_VERSION);

        // Verify the train is still present
        const locoRepo = await _db.openRepository(LocoRepository);
        const loco = await locoRepo.get(1);
        expect(loco.name).to.eql("Test Train");
        expect(loco.address).to.eql(1337);
        expect(loco.maxSpeed).to.eql(42);
    }

    afterEach(async () => {
        if (_db) {
            await _db.close();
            _db = null;
        }
    })

    it("From 1", async () => {
        await verifyDb(1);
    })
})
