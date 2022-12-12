import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import * as sqlite3 from "sqlite3";
import { Database } from "./database";
import { Statement } from "./statement";

describe("Statement", () => {
    let _statement: Statement = null;
    let _db: Database = null;

    function createTestTable() {
        return _db.run("CREATE TABLE test_table (key VARCHAR, value VARCHAR);");
    }
    
    function insertTestData(key: string, value: string) {
        return _db.run(`INSERT INTO test_table (key, value) VALUES ("${key}", "${value}");`);
    }

    beforeEach(async () => {
        _db = await Database.open(":memory:");
        await createTestTable();
    })

    afterEach(async () => {
        if (_statement) {
            await _statement.release();
            _statement = null;
        }
        if (_db) {
            await _db.close();
            _db = null;
        }
    })

    describe("get", () => {
        it("should return the full row if no transform is provided", async () => {
            await insertTestData("foo", "bar");
            _statement = await _db.prepare('SELECT * FROM test_table WHERE key = "foo";');

            const row = await _statement.get();

            expect(row).to.eql({
                key: "foo",
                value: "bar"
            });
        })

        it("should reject with error if execution of get fails", async () => {
            const mockSqlite3Statement = {
                get: (_params, cb) => {
                   cb(new Error("Get Error"));
                }
            } as sqlite3.Statement;

            const statement = new Statement(mockSqlite3Statement);

            await expect(statement.get()).to.eventually.be.rejectedWith("Get Error");
        })
    })

    describe("all", () => {
        it("should return full rows if no transform is provided", async () => {
            await insertTestData("foo", "bar");
            await insertTestData("baz", "gaz");
            _statement = await _db.prepare('SELECT * FROM test_table;');

            const rows = await _statement.all();

            expect(rows).to.eql([{
                key: "foo",
                value: "bar"
            }, {
                key: "baz",
                value: "gaz"
            }]);
        })

        it("should reject with error if execution fails for a row", async () => {
            const mockSqlite3Statement = {
                each: (_params, cbRow, _cbDone) => {
                    cbRow(new Error("Row Error"));
                }
            } as sqlite3.Statement;

            const statement = new Statement(mockSqlite3Statement);

            await expect(statement.all()).to.eventually.be.rejectedWith("Row Error");
        })

        it("should reject with error if execution fails for the statement", async () => {
            const mockSqlite3Statement = {
                each: (_params, _cbRow, cbDone) => {
                    cbDone(new Error("Statement Error"));
                }
            } as sqlite3.Statement;

            const statement = new Statement(mockSqlite3Statement);

            await expect(statement.all()).to.eventually.be.rejectedWith("Statement Error");
        })
    })

    describe("run", () => {
        it("should reject with error if execution of run fails", async () => {
            const mockSqlite3Statement = {
                run: (_params, cb) => {
                    cb(new Error("Run Error"));
                }
            } as sqlite3.Statement;

            const statement = new Statement(mockSqlite3Statement);

            await expect(statement.run()).to.eventually.be.rejectedWith("Run Error");
        })
    })

    describe("release", () => {
        it("should reject with error if low level finalize fails", async () => {
            const mockSqlite3Statement = {
                finalize: (cb) => {
                    cb(new Error("Test Error"));
                }
            } as sqlite3.Statement;

            const statement = new Statement(mockSqlite3Statement);
            await expect(statement.release()).to.eventually.be.rejectedWith("Test Error");
        })
    })
})
