import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import { Database } from "./database";
import { LocoRepository } from "./locoRepository";
import { LocoView } from "./locoview";

const TEST_VIEW = "Test View";

describe("LocoView", () => {
    let _db: Database | null = null;

    async function addLoco(repo: LocoRepository) {
        await repo?.insert({
            address: 1,
            discrete: false,
            name: ""
        });
    }

    beforeEach(async () => {
        _db = await Database.open(":memory:");
        await _db.run('INSERT INTO loco_views(name) VALUES ("Test View");');
        await _db.run('INSERT INTO loco_views(name) VALUES ("Test 1");');
        await _db.run('INSERT INTO loco_views(name) VALUES ("Test 2");');

        const repo = await _db.openRepository(LocoRepository);
        for (let i = 0; i < 10; i++) {
            await addLoco(repo);
        }
    })

    afterEach(async () => {
        try {
            await _db?.close();
        }
        catch (err) {
            const message: string = err.message;
            if (!message.includes("Database is closed")) throw err;
        }
        _db = null;
    })

    describe("getView", () => {
        it("should create an empty view and preserve view name", async () => {
            const view = await LocoView.getView(TEST_VIEW);

            expect(view.viewName).to.equal("Test View");
            expect([...await view.locoIds]).to.be.empty;
        })

        it("should reject with an error if view doesn't exist", async () => {
            await expect(LocoView.getView("Not Found")).to.be.eventually.rejectedWith("View not found");
        })
    })

    describe("addLoco", () => {
        it("should populate view", async () => {
            const view = await LocoView.getView(TEST_VIEW);

            await view.addLoco(3);

            expect([...await view.locoIds]).to.eql([3]);
        })

        it("should populate view with multile unique ids", async () => {
            const view = await LocoView.getView(TEST_VIEW);

            await view.addLoco(3);
            await view.addLoco(5);
            await view.addLoco(7);

            expect([...await view.locoIds]).to.eql([3, 5, 7]);
        })

        it("should not populate duplicate ids", async () => {
            const view = await LocoView.getView(TEST_VIEW);

            await view.addLoco(7);
            await view.addLoco(7);
            await view.addLoco(7);

            expect([...await view.locoIds]).to.eql([7]);
        })

        it("should reject invalid locoIds", async () => {
            const view = await LocoView.getView(TEST_VIEW);

            await expect(view.addLoco(1000)).to.be.eventually.rejectedWith("SQLITE_CONSTRAINT: FOREIGN KEY constraint failed");
        })
    })

    describe("removeLoco", () => {
        it("should be safe to remove non-existent id from an empty view", async () => {
            const view = await LocoView.getView(TEST_VIEW);

            await view.removeLoco(3);

            expect([...await view.locoIds]).to.be.empty;
        })

        it("should be safe to remove non-existent id from a populated view", async () => {
            const view = await LocoView.getView(TEST_VIEW);

            await view.addLoco(7);
            await view.addLoco(5);
            await view.addLoco(8);

            await view.removeLoco(3);

            expect([...await view.locoIds]).to.eql([5, 7, 8]);
        })

        it("should remove existing id from view", async () => {
            const view = await LocoView.getView(TEST_VIEW);

            await view.addLoco(7);
            await view.addLoco(8);
            await view.addLoco(9);

            await view.removeLoco(8);

            expect([...await view.locoIds]).to.eql([7, 9]);
        })

        it("should be able to remove all ids from a view", async () => {
            const view = await LocoView.getView(TEST_VIEW);

            await view.addLoco(5);
            await view.addLoco(7);
            await view.addLoco(6);

            await view.removeLoco(7);
            await view.removeLoco(6);
            await view.removeLoco(5);

            expect([...await view.locoIds]).to.be.empty;
        })
    })

    describe("hasLoco", () => {
        it("should return false for an empty view", async () => {
            const view = await LocoView.getView(TEST_VIEW);

            expect(await view.hasLoco(3)).to.be.false;
        })

        it("should return false for a non-existent loco in a populated view", async () => {
            const view = await LocoView.getView(TEST_VIEW);

            await view.addLoco(7);
            await view.addLoco(6);
            await view.addLoco(4);

            expect(await view.hasLoco(3)).to.be.false;
        })

        it("should return true for an existing loco in a populated view", async () => {
            const view = await LocoView.getView(TEST_VIEW);

            await view.addLoco(3);
            await view.addLoco(5);
            await view.addLoco(9);

            expect(await view.hasLoco(5)).to.be.true;
        })
    })

    describe("Database.openLocoView", async () => {
        it("should create view on first call", async () => {
            const view = await _db?.openLocoView("Test View") as LocoView;

            expect(view.viewName).to.equal("Test View");
        })

        it("should reuse existing view instance on subsequent calls with same view name", async () => {
            const db = _db as Database;
            const viewInital = await db.openLocoView("Test View");
            const viewSecond = await db.openLocoView("Test View");
            const viewThird = await db.openLocoView("Test View");

            expect(viewSecond).to.equal(viewInital);
            expect(viewThird).to.equal(viewInital);
        })

        it("should not reuse existing view instance for different view names", async () => {
            const db = _db as Database;
            const view1 = await db.openLocoView("Test 1");
            const view2 = await db.openLocoView("Test 2");

            expect(view1).to.not.equal(view2);
        })
    })
})