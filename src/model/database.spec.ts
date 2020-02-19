import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import { Database } from "./database";
import * as sqlite3 from "sqlite3";
import * as fs from "fs";

const TEST_DB_FILE = ".test.sqlite3";

function cleanupTestDb() {
    if (fs.existsSync(TEST_DB_FILE)) {
        fs.unlinkSync(TEST_DB_FILE);
    }
}

async function createTestTable(db: Database) {
    return db.run("CREATE TABLE test (key VARCHAR, value ANY); CREATE INDEX test_index ON test (key);");
}

describe("Database", () => {
    let _db: Database = null;

    beforeEach(async () => {
        _db = await Database.open(":memory:");
        cleanupTestDb();
    })

    afterEach(async () => {
        try {
            await _db.close();
        }
        catch (err) {
            const message: string = err.message;
            if (!message.includes("Database is closed")) throw err;
        }
        _db = null;

        cleanupTestDb();
    })

    describe("open", () => {
        it("should open if path is valid", async () => {
            expect(_db).to.not.be.null;
            expect(_db.sqlite3).to.be.instanceOf(sqlite3.Database);
            expect(_db.schemaVersion).to.equal(100);
        })

        it("should reopen existing databases", async () => {
            const db1 = await Database.open(TEST_DB_FILE);
            await db1.setValue("Test", "Foo Bar Baz");
            await db1.close();

            const db2 = await Database.open(TEST_DB_FILE);
            try {
                expect(db2.schemaVersion).to.equal(100);
                const value = await db2.getValue("Test");
                expect(value).to.equal("Foo Bar Baz");
            }
            finally {
                await db2.close();
            }
        })

        it("should fail if path is invalid", async () => {
            await expect(Database.open(":invalid:")).to.be.eventually.rejected;
        })
    })

    describe("close", () => {
        it("should close an open db", async () => {
            await _db.close();
            await expect(createTestTable(_db)).to.be.eventually.rejected;
        })

        it("should fail if already closed", async () => {
            await _db.close();
            await expect(_db.close()).to.be.eventually.rejectedWith("SQLITE_MISUSE: Database is closed");
        })
    })

    describe("run", () => {
        it("should execute valid SQL statements", async () => {
            await createTestTable(_db);
            const result = await _db.run('INSERT INTO test (key, value) VALUES ("foo", "bar");');
            expect(result.lastID).to.equal(1);
        })

        it("should execute valid SQL statements with params", async () => {
            await createTestTable(_db);
            const result = await _db.run('INSERT INTO test (key, value) VALUES ($key, $value);', {
                $key: "test1",
                $value: "test2"
            });
            expect(result.lastID).to.equal(1);

            // Verify the data was written correctly
            const data = await _db.get('SELECT * FROM test WHERE key = "test1";');
            expect(data.key).to.equal("test1");
            expect(data.value).to.equal("test2");
        })

        it ("should fail for invalid statements", async () => {
            await expect(_db.run('INSERT INTO test (key, value) VALUES ("foo", "bar");')).to.be.eventually.rejected;
        })
    })

    describe("get", () => {
        it("should execute valid SQL statements", async () => {
            await createTestTable(_db);
            await _db.run('INSERT INTO test (key, value) VALUES ("foo", "bar");');
            const data = await _db.get('SELECT * FROM test WHERE key = "foo";');
            expect(data.key).to.equal("foo");
            expect(data.value).to.equal("bar");
        })

        it("should execute valid SQL statements with params", async () => {
            await createTestTable(_db);
            await _db.run('INSERT INTO test (key, value) VALUES ("foo", "bar");');
            await _db.run('INSERT INTO test (key, value) VALUES ("baz", 0);');
            const data = await _db.get('SELECT * FROM test WHERE key = $key;', {
                $key: "baz"
            });
            expect(data.key).to.equal("baz");
            expect(data.value).to.equal(0);
        })

        it("should return undefined for not found values", async () => {
            await createTestTable(_db);
            const data = await _db.get('SELECT * FROM test WHERE key = "foo";');
            expect(data).to.be.undefined;
        });

        it ("should fail for invalid statements", async () => {
            await expect(_db.get('SELECT * FROM test WHERE key = "foo";')).to.be.eventually.rejected;
        })
    })

    describe("key value store", () => {
        it("should store new values", async () => {
            await _db.setValue("test", "foo");
            const value = await _db.getValue("test");
            expect(value).to.equal("foo");
        })

        it("should update existing values", async () => {
            await _db.setValue("test", "foo");
            await _db.setValue("test", "bar");
            const value = await _db.getValue("test");
            expect(value).to.equal("bar");

            // Verify the table updated correctly
            const count = await _db.get('SELECT COUNT(*) AS value FROM _kv_store WHERE key = "test"');
            expect(count.value).to.equal(1);
        })

        it("should return undefined for unset values", async () => {
            const value = await _db.getValue("test");
            expect(value).to.be.undefined;
        })
    })
})