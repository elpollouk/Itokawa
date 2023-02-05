import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import * as fs from "fs";

import { Database } from "./database";
import { LocoRepository } from "./locoRepository";

const EXPECTED_SCHEMA_VERSION = 3;
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
    let _db: Database = null as any;

    async function verifyDb(fromSchema: number) {
        copyForTest(fromSchema);

        _db = await Database.open(TEST_DB_FILE);
        expect(_db.schemaVersion).to.eql(EXPECTED_SCHEMA_VERSION);

        // Verify the train is still present
        const locoRepo = await _db.openRepository(LocoRepository);
        const loco = await locoRepo.get(1);
        expect(loco.name).to.eql("Test Train");
        expect(loco.address).to.eql(1337);
        expect(loco.maxSpeed).to.eql(42);

        if (fromSchema < 2) return;

        // Verify user sessions table
        const sessions = await _db.all("SELECT * FROM user_sessions;");
        expect(sessions).to.eql([
            { id: "0123456789abcdef", userId: 100, expires: 6400000000000 },
            { id: "fedcba9876543210", userId: 200, expires: 9876543210 }
        ]);

        if (fromSchema < 3) return;

        // Verify loco views
        const views = await _db.all("SELECT * FROM loco_views;");
        expect(views).to.eql([
            { id: 1, name: "On Track" },
        ]);

        const view_mapping = await _db.all("SELECT * FROM loco_view_mapping;");
        expect(view_mapping).to.eql([
            { viewId: 1, locoId: 2 }
        ])
    }

    afterEach(async () => {
        if (_db) {
            await _db.close();
            _db = null as any;
        }
    })

    it("From 1", () => verifyDb(1));
    it("From 2", () => verifyDb(2));
    it("From 3", () => verifyDb(3));

    /*it("Creat Test DB File", async () => {
        copyForTest(2);
        _db = await Database.open(TEST_DB_FILE);

        await _db.run('INSERT INTO locos ( search_text, item ) VALUES ( "Test 2", $json );', {
            $json: '{"id":2,"name":"Test 2","address":4321,"discrete":false}'
        });
        await _db.run('INSERT INTO loco_view_mapping ( viewId, locoId ) VALUES ( 1, 2 );');

        await _db.close();
        fs.copyFileSync(TEST_DB_FILE, "testdata/old_schemas/schema_3.sqlite3");
    })*/
})
