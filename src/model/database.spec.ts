import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import { stub } from "sinon";
import { Database } from "./database";
import * as sqlite3 from "sqlite3";
import * as fs from "fs";
import { rmDir, rmFile } from "../utils/testUtils";

const EXPECTED_SCHEMA_VERSION = 3;
const TEST_DB_FILE = ".test.sqlite3";

function cleanupTestDb() {
    if (fs.existsSync(TEST_DB_FILE)) {
        fs.unlinkSync(TEST_DB_FILE);
    }
}

function copyForTest(path: string) {
    cleanupTestDb();
    fs.copyFileSync(path, TEST_DB_FILE);
}

async function createTestTable(db: Database) {
    return db.run("CREATE TABLE test (key VARCHAR, value ANY);");
}

describe("Database", () => {
    let _db: Database = null as any;

    beforeEach(async () => {
        _db = await Database.open(":memory:");
        cleanupTestDb();
    })

    afterEach(async () => {
        try {
            await _db?.close();
        }
        catch (err) {
            const message: string = err.message;
            if (!message.includes("Database is closed")) throw err;
        }
        _db = null as any;

        cleanupTestDb();
    })

    describe("open", () => {
        it("should open if path is valid", async () => {
            expect(_db).to.not.be.null;
            expect(_db.sqlite3).to.be.instanceOf(sqlite3.Database);
            expect(_db.schemaVersion).to.equal(EXPECTED_SCHEMA_VERSION);
        })

        it("should reopen existing databases", async () => {
            await _db.close();
            _db = null as any;

            const db1 = await Database.open(TEST_DB_FILE);
            await db1.setValue("Test", "Foo Bar Baz");
            await db1.close();

            const db2 = await Database.open(TEST_DB_FILE);
            try {
                expect(db2.schemaVersion).to.equal(EXPECTED_SCHEMA_VERSION);
                const value = await db2.getValue("Test");
                expect(value).to.equal("Foo Bar Baz");
            }
            finally {
                await db2.close();
            }
        })

        it("should not load DB schema if number version is higher than application", async () => {
            copyForTest("./testdata/schema_99999.sqlite3");
            await expect(Database.open(TEST_DB_FILE)).to.be.eventually.rejectedWith("Database schema version higher than supported");
        })

        it("should fail if path is invalid", async () => {
            await expect(Database.open("/")).to.be.eventually.rejected;
        })

        it("should raise an error if we've messed up the schema scripts path", async () => {
            const readdirStub = stub(fs, "readdirSync").returns([]);
            try {
                await expect(Database.open(":memory:")).to.be.eventually.rejectedWith("No schema scripts found");
            }
            finally {
                readdirStub.restore();
            }
        })

        it("should support foreign keys", async () => {
            const result = await _db.get("PRAGMA foreign_keys;");
            expect(result.foreign_keys).to.equal(1);
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

    describe("exec", () => {
        it("should execute multiple valid SQL statements", async () => {
            await createTestTable(_db);
            await _db.exec(`
                CREATE TABLE test2 (key VARCHAR, value ANY);
                CREATE INDEX test2_idx ON test (key);
                INSERT INTO test2 (key, value) VALUES ("test", 12345);
            `);
            
            const result = await _db.get('SELECT * FROM test2 WHERE key="test"');
            expect(result).to.eql({
                key: "test",
                value: 12345
            });
        })

        it ("should fail for invalid statements", async () => {
            await expect(_db.exec('INSERT INTO test (key, value) VALUES ("foo", "bar");')).to.be.eventually.rejected;
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

    describe("all", () => {
        it("should execute valid SQL statements", async () => {
            await createTestTable(_db);
            await _db.run('INSERT INTO test (key, value) VALUES ("foo", "bar");');
            await _db.run('INSERT INTO test (key, value) VALUES ("baz", "bob");');

            const rows = await _db.all('SELECT * FROM test;');

            expect(rows).to.eql([
                { key: "foo", value: "bar" },
                { key: "baz", value: "bob" }
            ]);
        })

        it("should execute valid SQL statements with params", async () => {
            await createTestTable(_db);
            await _db.run('INSERT INTO test (key, value) VALUES ("foo", "bar");');
            await _db.run('INSERT INTO test (key, value) VALUES ("baz", "bob");');
            await _db.run('INSERT INTO test (key, value) VALUES ("cat", "bob");');

            const rows = await _db.all('SELECT * FROM test WHERE value = $value;', {
                $value: "bob"
            });

            expect(rows).to.eql([
                { key: "baz", value: "bob" },
                { key: "cat", value: "bob" }
            ]);
        })

        it("should return empty array for not found values", async () => {
            await createTestTable(_db);
            const rows = await _db.all('SELECT * FROM test WHERE key = "foo";');
            expect(rows).to.eql([]);
        });

        it ("should fail for invalid statements", async () => {
            await expect(_db.all('SELECT * FROM test WHERE key = "foo";')).to.be.eventually.rejected;
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

    describe("backup", () => {
        const BACKUP_DB = ".test.dbbackup.sqlite3";
        const BACKUP_DIR = ".test.dbbackup";

        beforeEach(() => {
            rmFile(BACKUP_DB);
            rmDir(BACKUP_DIR);
        })

        it("should create a new backup file", async () => {
            expect(fs.existsSync(BACKUP_DB)).to.be.false;

            await _db.backup(BACKUP_DB);

            expect(fs.existsSync(BACKUP_DB)).to.be.true;
        })

        it("should create a new backup file into a sub directory", async () => {
            const path = BACKUP_DIR + "/backup.sqlite3";
            fs.mkdirSync(BACKUP_DIR);

            await _db.backup(path);

            expect(fs.existsSync(path)).to.be.true;
        })

        it("should reject invalid paths", async () => {
            await expect(_db.backup("/")).to.be.eventually.rejected;
        })
    })
})