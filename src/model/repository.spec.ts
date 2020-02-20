import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import { stub } from "sinon";
import { Database } from "./database";
import * as sqlite3 from "sqlite3";
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

    _indexItemForSearch(item: DataItem): string {
        if (!item.field2 || item.field2.length < 2) {
            return `${item.field1 || ""}`;
        }
        else {
            return `${item.field1} ${item.field2[1]}`;
        }
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

        it("should reject with error if preparing statement fails", async () => {
            const functionStub = stub(sqlite3.Database.prototype, "prepare").callsFake((sql, cb) => {
                cb(new Error("Prepare Error"));
                return {} as sqlite3.Statement;
            });

            try {
                await expect(_db.openRepository(TestRepository)).to.eventually.be.rejectedWith("Prepare Error");
            }
            finally {
                functionStub.restore();
            }
        });
    })

    describe("Database.close", () => {
        it("should release any repositories that it created", async () => {
            await _db.openRepository(TestRepository);
            await _db.close();
        })
    })

    describe("release", () => {
        it("should be safe to double release", async () => {
            const repo = await _db.openRepository(TestRepository);
            await repo.release();
            await repo.release();
        })

        it("should reject with error if low level finalize fails", async () => {
            const repo = await _db.openRepository(TestRepository);

            const functionStub = stub(sqlite3.Statement.prototype, "finalize").callsFake((cb) => {
                cb(new Error("Test Error"));
                return _db.sqlite3;
            });

            try {
                await expect(repo.release()).to.eventually.be.rejectedWith("Test Error");
            }
            finally {
                functionStub.restore();
            }
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

        it("should return a list of items if they match query", async () => {
            const repo = await _db.openRepository(TestRepository);
            await repo.insert({
                field1: "Foo",
                field2: [1, 2, 3]
            });
            await repo.insert({
                field1: "Bar",
                field2: [4, 5, 6]
            });

            let items = await repo.list("o");
            expect(items).to.eql([{
                id: 1,
                field1: "Foo",
                field2: [1, 2, 3]
            }]);

            items = await repo.list("5");
            expect(items).to.eql([{
                id: 2,
                field1: "Bar",
                field2: [4, 5, 6]
            }]);
        })

        it("should reject with error if execution fails for a row", async () => {
            const repo = await _db.openRepository(TestRepository);

            const functionStub = stub(sqlite3.Statement.prototype, "each").callsFake((...args: any[]) => {
                args[1](new Error("Row Error"));
                return {} as sqlite3.Statement;
            });

            try {
                await expect(repo.list()).to.eventually.be.rejectedWith("Row Error");
            }
            finally {
                functionStub.restore();
            }
        })

        it("should reject with error if execution fails for the statement", async () => {
            const repo = await _db.openRepository(TestRepository);

            const functionStub = stub(sqlite3.Statement.prototype, "each").callsFake((...args: any[]) => {
                args[1](new Error("Statement Error"));
                return {} as sqlite3.Statement;
            });

            try {
                await expect(repo.list()).to.eventually.be.rejectedWith("Statement Error");
            }
            finally {
                functionStub.restore();
            }
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

        it("should correctly index the item", async () => {
            const indexStub = stub(TestRepository.prototype, "_indexItemForSearch").returns("index");

            try {
                const repo = await _db.openRepository(TestRepository);
                const item: DataItem = {
                    field1: "Foo",
                    field2: [1, 2, 3]
                };
                await repo.insert(item);
                
                expect(indexStub.callCount).to.equal(1);
                expect(indexStub.lastCall.args).to.eql([
                    item
                ]);
            }
            finally {
                indexStub.restore();
            }
        });

        it("should reject with error if execution of insert fails", async () => {
            const repo = await _db.openRepository(TestRepository);

            const functionStub = stub(sqlite3.Statement.prototype, "run").callsFake((params, cb) => {
                cb(new Error("Insert Error"));
                return {} as sqlite3.Statement;
            });

            try {
                await expect(repo.insert({} as DataItem)).to.eventually.be.rejectedWith("Insert Error");
            }
            finally {
                functionStub.restore();
            }
        })
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

        it("should reject with error if execution of get fails", async () => {
            const repo = await _db.openRepository(TestRepository);

            const functionStub = stub(sqlite3.Statement.prototype, "get").callsFake((params, cb) => {
                cb(new Error("Get Error"));
                return {} as sqlite3.Statement;
            });

            try {
                await expect(repo.get(1)).to.eventually.be.rejectedWith("Get Error");
            }
            finally {
                functionStub.restore();
            }
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

        it("should correctly index the item", async () => {
            const repo = await _db.openRepository(TestRepository);
            const item: DataItem = {
                field1: "Foo",
                field2: [1, 2, 3]
            };
            await repo.insert(item);

            const indexStub = stub(TestRepository.prototype, "_indexItemForSearch").returns("index");

            try {
                await repo.update(item);

                expect(indexStub.callCount).to.equal(1);
                expect(indexStub.lastCall.args).to.eql([
                    item
                ]);
            }
            finally {
                indexStub.restore();
            }
        });

        it("should fail for non-existing items", async () => {
            const repo = await _db.openRepository(TestRepository);

            const promise = repo.update({
                id: 2,
                field1: "Test",
                field2: [19, 23, 39]
            });
            await expect(promise).to.eventually.be.rejectedWith("Unexpected number of updates: 0");
        })

        it("should reject with error if execution of update fails", async () => {
            const repo = await _db.openRepository(TestRepository);

            const functionStub = stub(sqlite3.Statement.prototype, "run").callsFake((params, cb) => {
                cb(new Error("Update Error"));
                return {} as sqlite3.Statement;
            });

            try {
                await expect(repo.update({
                    id: 1
                } as DataItem)).to.eventually.be.rejectedWith("Update Error");
            }
            finally {
                functionStub.restore();
            }
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

        it("should reject with error if execution of delete fails", async () => {
            const repo = await _db.openRepository(TestRepository);

            const functionStub = stub(sqlite3.Statement.prototype, "run").callsFake((params, cb) => {
                cb(new Error("Delete Error"));
                return {} as sqlite3.Statement;
            });

            try {
                await expect(repo.delete(123)).to.eventually.be.rejectedWith("Delete Error");
            }
            finally {
                functionStub.restore();
            }
        })
    })
})