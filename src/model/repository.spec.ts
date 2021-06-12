import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import { stub } from "sinon";
import { Database } from "./database";
import * as sqlite3 from "sqlite3";
import { LocoRepository } from "./locoRepository";
import { Loco } from "../common/api";


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
            const repo = await _db.openRepository(LocoRepository);
            expect(repo).to.be.instanceOf(LocoRepository);
        })

        it("should reused cached repositories that already exist", async () => {
            const repo1 = await _db.openRepository(LocoRepository);
            const repo2 = await _db.openRepository(LocoRepository);
            expect(repo1).to.equal(repo2);
        })

        it("should reject with error if preparing statement fails", async () => {
            const functionStub = stub(sqlite3.Database.prototype, "prepare").callsFake((sql, cb) => {
                cb(new Error("Prepare Error"));
                return {} as sqlite3.Statement;
            });

            try {
                await expect(_db.openRepository(LocoRepository)).to.eventually.be.rejectedWith("Prepare Error");
            }
            finally {
                functionStub.restore();
            }
        });
    })

    describe("Database.close", () => {
        it("should release any repositories that it created", async () => {
            await _db.openRepository(LocoRepository);
            await _db.close();
        })
    })

    describe("release", () => {
        it("should be safe to double release", async () => {
            const repo = await _db.openRepository(LocoRepository);
            await repo.release();
            await repo.release();
        })
    })

    describe("list", () => {
        it("should return an empty list if there are no entries", async () => {
            const repo = await _db.openRepository(LocoRepository);
            const items = await repo.list();
            expect(items).to.eql([]);
        })

        it("should return a list of items if they exist", async () => {
            const repo = await _db.openRepository(LocoRepository);
            await repo.insert({
                name: "Foo",
                address: 3,
                discrete: true,
                speeds: [1, 2, 3]
            });
            await repo.insert({
                name: "Bar",
                address: 4,
                discrete: false,
                maxSpeed: 80
            });

            const items = await repo.list();
            expect(items).to.eql([{
                id: 1,
                name: "Foo",
                address: 3,
                discrete: true,
                speeds: [1, 2, 3]
            }, {
                id: 2,
                name: "Bar",
                address: 4,
                discrete: false,
                maxSpeed: 80
            }]);
        })

        it("should return a list of items if they match query", async () => {
            const repo = await _db.openRepository(LocoRepository);
            await repo.insert({
                name: "Foo",
                address: 3,
                discrete: true,
                speeds: [1, 2, 3]
            });
            await repo.insert({
                name: "Bar",
                address: 4,
                discrete: false,
                maxSpeed: 80
            });

            let items = await repo.list("Fo*");
            expect(items).to.eql([{
                id: 1,
                name: "Foo",
                address: 3,
                discrete: true,
                speeds: [1, 2, 3]
            }]);

            items = await repo.list("4");
            expect(items).to.eql([{
                id: 2,
                name: "Bar",
                address: 4,
                discrete: false,
                maxSpeed: 80
            }]);
        })

        it("should return an empty list no items match query", async () => {
            const repo = await _db.openRepository(LocoRepository);
            await repo.insert({
                name: "Foo",
                address: 3,
                discrete: true,
                speeds: [1, 2, 3]
            });
            await repo.insert({
                name: "Bar",
                address: 4,
                discrete: false,
                maxSpeed: 80
            });

            let items = await repo.list("Missing");
            expect(items).to.eql([]);
        })
    })

    describe("insert", () => {
        it("should correctly update inserted item", async () => {
            const repo = await _db.openRepository(LocoRepository);
            const item: Loco = {
                name: "Foo",
                address: 9,
                discrete: false,
                maxSpeed: 10
            };
            await repo.insert(item);
            
            expect(item.id).to.equal(1);
        });

        it("should correctly index the item", async () => {
            const indexStub = stub(LocoRepository.prototype, "_indexItemForSearch").returns("index");

            try {
                const repo = await _db.openRepository(LocoRepository);
                const item: Loco = {
                    name: "Foo",
                    address: 9,
                    discrete: false,
                    maxSpeed: 10
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
    })

    describe("get", () => {
        it("should fetch existing item", async () => {
            const repo = await _db.openRepository(LocoRepository);
            await repo.insert({
                name: "Item 1",
                address: 10,
                discrete: true,
                speeds: []
            });
            await repo.insert({
                name: "Item 2",
                address: 20,
                discrete: true,
                speeds: [11, 13, 17]
            });
            await repo.insert({
                name: "Item 3",
                address: 30,
                discrete: false,
                maxSpeed: 90
            });

            const item = await repo.get(2);
            expect(item).to.eql({
                id: 2,
                name: "Item 2",
                address: 20,
                discrete: true,
                speeds: [11, 13, 17]
            });
        })

        it("should return undefined for non-existing item", async () => {
            const repo = await _db.openRepository(LocoRepository);
            const item = await repo.get(123);
            expect(item).to.be.null;
        })
    })

    describe("update", () => {
        it("should correctly update existing item", async () => {
            const repo = await _db.openRepository(LocoRepository);
            await repo.insert({
                name: "Item 1",
                address: 1234,
                discrete: true,
                speeds: [3, 5, 7]
            });
            await repo.insert({
                name: "Item 2",
                address: 432,
                discrete: true,
                speeds: [11, 13, 17]
            });

            await repo.update({
                id: 2,
                name: "Test",
                address: 432,
                discrete: false,
                maxSpeed: 80
            });

            const items = await repo.list();
            expect(items).to.eql([{
                id: 1,
                name: "Item 1",
                address: 1234,
                discrete: true,
                speeds: [3, 5, 7]
            }, {
                id: 2,
                name: "Test",
                address: 432,
                discrete: false,
                maxSpeed: 80
            }]);
        })

        it("should correctly index the item", async () => {
            const repo = await _db.openRepository(LocoRepository);
            const item: Loco = {
                name: "Foo",
                address: 1,
                discrete: true,
                speeds: [1, 2, 3]
            };
            await repo.insert(item);

            const indexStub = stub(LocoRepository.prototype, "_indexItemForSearch").returns("index");

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
            const repo = await _db.openRepository(LocoRepository);

            const promise = repo.update({
                id: 2,
                name: "Test",
                address: 3,
                discrete: true,
                speeds: [19, 23, 39]
            });
            await expect(promise).to.eventually.be.rejectedWith("Unexpected number of updates: 0");
        })
    })

    describe("delete", () => {
        it("should remove existing item", async () => {
            const repo = await _db.openRepository(LocoRepository);
            await repo.insert({
                name: "Item 1",
                address: 1,
                discrete: true,
                speeds: [3, 5, 7]
            });
            await repo.insert({
                name: "Item 2",
                address: 2,
                discrete: true,
                speeds: [11, 13, 17]
            });

            await repo.delete(1);

            const items = await repo.list();
            expect(items).to.eql([{
                id: 2,
                name: "Item 2",
                address: 2,
                discrete: true,
                speeds: [11, 13, 17]
            }]);
        })

        it("should be idempotent (i.e. you can delete things that have already been deleted)", async () => {
            const repo = await _db.openRepository(LocoRepository);
            await repo.insert({
                name: "Item 1",
                address: 1,
                discrete: true,
                speeds: [3, 5, 7]
            });

            await repo.delete(1);
            await repo.delete(1);

            const items = await repo.list();
            expect(items).to.eql([]);
        })
    })
})