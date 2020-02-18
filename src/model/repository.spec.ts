import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import { Database } from "./database";
import { SqliteRepository } from "./repository";

interface DataItem {
    id?: number,
    field1: string,
    field2: number[],
}

class TestRepository extends SqliteRepository<DataItem> {
    constructor(db: Database) {
        super(db, "test", "item");
    }
}

describe("Repository", () => {
    let _db: Database = null;

    beforeEach(async () => {
        _db = await Database.open(":memory:");
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
    })

    describe("openRepository", () => {
        it("should return a valid repository", async () => {
            const repo = await _db.openRepository(TestRepository);
            expect(repo).to.be.instanceOf(TestRepository);
        })

        it("should reused cached repositories that already exist", async () => {
            const repo1 = await _db.openRepository(TestRepository);
            const repo2 = await _db.openRepository(TestRepository);
            expect(repo1).to.equal(repo2);
        })


        it("double release should be safe", async () => {
            const repo = await _db.openRepository(TestRepository);
            await repo.release();
            await repo.release();
        })
    })

    describe("Database.close", () => {
        it("should release any repositories that it created", async () => {
            await _db.openRepository(TestRepository);
            await _db.close();
        })
    })

    describe("list", () => {
        it("should return an empty list if there are no entries", async () => {
            const repo = await _db.openRepository(TestRepository);
            const items = await repo.list();
            expect(items).to.eql([]);
        })

        it("should return a list of items if they exist", async () => {
            const repo = await _db.openRepository(TestRepository);
            await repo.insert({
                field1: "Foo",
                field2: [1, 2, 3]
            });
            await repo.insert({
                field1: "Bar",
                field2: [4, 5, 6]
            });

            const items = await repo.list();
            expect(items).to.eql([{
                id: 1,
                field1: "Foo",
                field2: [1, 2, 3]
            }, {
                id: 2,
                field1: "Bar",
                field2: [4, 5, 6]
            }]);
        })
    })

    describe("insert", () => {
        it("should correctly update inserted item", async () => {
            const repo = await _db.openRepository(TestRepository);
            const item: DataItem = {
                field1: "Foo",
                field2: [1, 2, 3]
            };
            await repo.insert(item);
            
            expect(item.id).to.equal(1);
        });
    })

    describe("get", () => {
        it("should fetch existing item", async () => {
            const repo = await _db.openRepository(TestRepository);
            await repo.insert({
                field1: "Item 1",
                field2: []
            });
            await repo.insert({
                field1: "Item 2",
                field2: [11, 13, 17]
            });
            await repo.insert({
                field1: "Item 3",
                field2: []
            });

            const item = await repo.get(2);
            expect(item).to.eql({
                id: 2,
                field1: "Item 2",
                field2: [11, 13, 17]
            });
        })

        it("should return undefined for non-existing item", async () => {
            const repo = await _db.openRepository(TestRepository);
            const item = await repo.get(123);
            expect(item).to.be.undefined;
        })
    })

    describe("update", () => {
        it("should correctly update existing item", async () => {
            const repo = await _db.openRepository(TestRepository);
            await repo.insert({
                field1: "Item 1",
                field2: [3, 5, 7]
            });
            await repo.insert({
                field1: "Item 2",
                field2: [11, 13, 17]
            });

            await repo.update({
                id: 2,
                field1: "Test",
                field2: [19, 23, 39]
            });

            const items = await repo.list();
            expect(items).to.eql([{
                id: 1,
                field1: "Item 1",
                field2: [3, 5, 7]
            }, {
                id: 2,
                field1: "Test",
                field2: [19, 23, 39]
            }]);
        })

        it("should fail for non-existing items", async () => {
            const repo = await _db.openRepository(TestRepository);

            const promise = repo.update({
                id: 2,
                field1: "Test",
                field2: [19, 23, 39]
            });
            await expect(promise).to.eventually.be.rejectedWith("Unexpected number of updates: 0");
        })
    })

    describe("delete", () => {
        it("should remove existing item", async () => {
            const repo = await _db.openRepository(TestRepository);
            await repo.insert({
                field1: "Item 1",
                field2: [3, 5, 7]
            });
            await repo.insert({
                field1: "Item 2",
                field2: [11, 13, 17]
            });

            await repo.delete(1);

            const items = await repo.list();
            expect(items).to.eql([{
                id: 2,
                field1: "Item 2",
                field2: [11, 13, 17]
            }]);
        })

        it("should be idempotent (i.e. you can delete things that have already been deleted)", async () => {
            const repo = await _db.openRepository(TestRepository);
            await repo.insert({
                field1: "Item 1",
                field2: [3, 5, 7]
            });

            await repo.delete(1);
            await repo.delete(1);

            const items = await repo.list();
            expect(items).to.eql([]);
        })
    })
})