import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
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
    })

    describe("each", () => {
        it("should return full rows if no transform is provided", async () => {
            await insertTestData("foo", "bar");
            await insertTestData("baz", "gaz");
            _statement = await _db.prepare('SELECT * FROM test_table;');

            const rows = await _statement.each();

            expect(rows).to.eql([{
                key: "foo",
                value: "bar"
            }, {
                key: "baz",
                value: "gaz"
            }]);
        })
    })
})