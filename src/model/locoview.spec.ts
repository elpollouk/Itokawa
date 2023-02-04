import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import { Database } from "./database";

import { LocoView } from "./locoview";
import { OnTrackView } from "./ontrackview";

class TestView extends LocoView {
    public constructor() {
        super("Test View");
    }
}

describe("LocoView", () => {
    describe("construct", () => {
        it("should create and empty view and preserve view name", async () => {
            const view = new TestView();

            expect(view.viewKey).to.equal("Test View");
            expect([...await view.locoIds]).to.be.empty;
        })
    })

    describe("addLoco", () => {
        it("should populate view", async () => {
            const view = new TestView();

            await view.addLoco(3);

            expect([...await view.locoIds]).to.eql([3]);
        })

        it("should populate view with multile unique ids", async () => {
            const view = new TestView();

            await view.addLoco(3);
            await view.addLoco(7);
            await view.addLoco(11);

            expect([...await view.locoIds]).to.eql([3, 7, 11]);
        })

        it("should not populate duplicate ids", async () => {
            const view = new TestView();

            await view.addLoco(7);
            await view.addLoco(7);
            await view.addLoco(7);

            expect([...await view.locoIds]).to.eql([7]);
        })
    })

    describe("removeLoco", () => {
        it("should be safe to remove non-existent id from an empty view", async () => {
            const view = new TestView();

            await view.removeLoco(3);

            expect([...await view.locoIds]).to.be.empty;
        })

        it("should be safe to remove non-existent id from a populated view", async () => {
            const view = new TestView();

            await view.addLoco(7);
            await view.addLoco(11);
            await view.addLoco(13);

            await view.removeLoco(3);

            expect([...await view.locoIds]).to.eql([7, 11, 13]);
        })

        it("should remove existing id from view", async () => {
            const view = new TestView();

            await view.addLoco(7);
            await view.addLoco(11);
            await view.addLoco(13);

            await view.removeLoco(11);

            expect([...await view.locoIds]).to.eql([7, 13]);
        })

        it("should be able to remove all ids from a view", async () => {
            const view = new TestView();

            await view.addLoco(7);
            await view.addLoco(11);
            await view.addLoco(13);

            await view.removeLoco(11);
            await view.removeLoco(13);
            await view.removeLoco(7);

            expect([...await view.locoIds]).to.be.empty;
        })
    })

    describe("hasLoco", () => {
        it("should return false for an empty view", async () => {
            const view = new TestView();

            expect(await view.hasLoco(3)).to.be.false;
        })

        it("should return false for a non-existent loco in a populated view", async () => {
            const view = new TestView();

            await view.addLoco(7);
            await view.addLoco(11);
            await view.addLoco(13);

            expect(await view.hasLoco(3)).to.be.false;
        })

        it("should return true for an existing loco in a populated view", async () => {
            const view = new TestView();

            await view.addLoco(7);
            await view.addLoco(11);
            await view.addLoco(13);

            expect(await view.hasLoco(11)).to.be.true;
        })
    })

    describe("OnTrackView", () => {
        it('should used "On Track" as the view key', () => {
            const view = new OnTrackView();

            expect(view.viewKey).to.equal("On Track");
        })
    })

    describe("Database.openLocoView", async () => {
        let _db: Database;

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
        })

        it("should create view on first call", async () => {
            const view = await _db.openLocoView(OnTrackView);

            expect(view.viewKey).to.equal(OnTrackView.VIEW_KEY);
        })

        it("should reuse existing view instance on subsequent calls", async () => {
            const viewInital = await _db.openLocoView(OnTrackView);
            const viewSecond = await _db.openLocoView(OnTrackView);
            const viewThird = await _db.openLocoView(OnTrackView);

            expect(viewSecond === viewInital).to.be.true;
            expect(viewThird === viewInital).to.be.true;
        })
    })
})