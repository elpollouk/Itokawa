import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import { stub, restore, SinonStub } from "sinon";

import * as express from "express";
import * as cookieParser from "cookie-parser";
import { requestGet, requestPost, requestPut, requestDelete } from "../../utils/testUtils";
import { getRouter } from "./apiRouter";
import { application } from "../../application";
import { LocoRepository } from "../../model/locoRepository";
import { Permissions } from "../sessionmanager";
import { LocoView } from "../../model/locoview";
import { VIEW_ONTRACK } from "../../common/api";

describe("apiRouter", async () => {
    let _app: express.Express;
    let _repo: LocoRepository;
    let _hasPermission: SinonStub;
    let _locoViews: Map<string, LocoView>;

    async function get(path: string): Promise<any> {
        const response = await requestGet(_app, path, {
            sessionId: "mock_session_id"
        });

        return JSON.parse(response.text);
    }

    async function post(path: string, data: any): Promise<any> {
        const response = await requestPost(_app, path, {
            sessionId: "mock_session_id",
            json: data
        });

        return response.text ? JSON.parse(response.text) : null;
    }

    async function put(path: string, data: any): Promise<any> {
        const response = await requestPut(_app, path, {
            sessionId: "mock_session_id",
            json: data
        });

        return response.text ? JSON.parse(response.text) : null;
    }

    async function del(path: string): Promise<void> {
        const response = await requestDelete(_app, path, {
            sessionId: "mock_session_id"
        });
    }

    beforeEach(async () => {
        _repo = new LocoRepository(null as any);
        _locoViews = new Map([
            [VIEW_ONTRACK,  new LocoView(VIEW_ONTRACK)]
        ]);

        const db = {
            openRepository: stub().resolves(_repo),
            openLocoView: (name: string) => Promise.resolve(_locoViews.get(name))
        }
        stub(application, "database").value(db);
        _hasPermission = stub(application.sessionManager, "hasPermission")
            .withArgs(Permissions.TRAIN_EDIT, "mock_session_id").resolves(true);

        _app = express();
        _app.use(cookieParser());
        _app.use("/", await getRouter());
    })

    afterEach(() => {
        restore();
    })

    describe("GET /track_locos", () => {
        let _repoStub: SinonStub;

        beforeEach(() => {
            _repoStub = stub(_repo, "list").resolves([
                { id: 3,  address: 4,  name: "Test 1", discrete: false },
                { id: 7,  address: 8,  name: "Test 2", discrete: false, maxSpeed: 90 },
                { id: 11, address: 12, name: "Test 3", discrete: true, speeds: [4, 5, 6] }
            ]);
        })

        it("should return no results if no locos are on track", async () => {
            const locos = await get("/track_locos");

            expect(locos).to.eql([]);
        })

        it("should return only the locos that have been added to the track", async () => {
            await _locoViews.get(VIEW_ONTRACK)?.addLoco(3);
            await _locoViews.get(VIEW_ONTRACK)?.addLoco(11);

            const locos = await get("/track_locos");

            expect(locos).to.eql([
                { id: 3,  address: 4,  name: "Test 1", discrete: false },
                { id: 11, address: 12, name: "Test 3", discrete: true, speeds: [4, 5, 6] }
            ]);
        })

        it("should return a 500 error on DB exception", async () => {
            _repoStub.rejects(new Error());

            await expect(get("/track_locos")).to.be.eventually.rejectedWith(/500/);
        })
    })

    describe("GET /locos", () => {
        it("should return the results from an empty database", async () => {
            stub(_repo, "list").resolves([]);

            const locos = await get("/locos");

            expect(locos).to.eql([]);
        })

        it("should return the results from a populated database", async () => {
            stub(_repo, "list").resolves([
                { id: 3,  address: 4,  name: "Test 1", discrete: false },
                { id: 7,  address: 8,  name: "Test 2", discrete: false, maxSpeed: 90 },
                { id: 11, address: 12, name: "Test 3", discrete: true, speeds: [4, 5, 6] }
            ]);

            const locos = await get("/locos");

            expect(locos).to.eql([
                { id: 3,  address: 4,  name: "Test 1", discrete: false },
                { id: 7,  address: 8,  name: "Test 2", discrete: false, maxSpeed: 90 },
                { id: 11, address: 12, name: "Test 3", discrete: true, speeds: [4, 5, 6] }
            ]);
        })

        it("should set ephemeral data if loco is on track", async () => {
            await _locoViews.get(VIEW_ONTRACK)?.addLoco(7);
            stub(_repo, "list").resolves([
                { id: 3, address: 4, name: "Test 1", discrete: false },
                { id: 7, address: 8, name: "Test 2", discrete: false }
            ]);

            const locos = await get("/locos");

            expect(locos[0]._emphemeral).to.be.undefined;
            expect(locos[1]._emphemeral.onTrack).to.be.true;
        })

        it("should return 404 if user doesn't have permission", async () => {
            _hasPermission.resolves(false);

            await expect(get("/locos")).to.be.eventually.rejectedWith(/404/);
        })

        it("should return a 500 error on DB exception", async () => {
            stub(_repo, "list").rejects(new Error());

            await expect(get("/locos")).to.be.eventually.rejectedWith(/500/);
        })
    })

    describe("POST /locos", () => {
        it("should insert provided data in database", async () => {
            const insert = stub(_repo, "insert").resolves();
            const loco = {
                name: "foo"
            };

            const result = await post("/locos", loco);

            expect(result).to.eql(loco);
            expect(insert.callCount).to.eql(1);
            expect(insert.lastCall.args).to.eql([loco]);
        })

        it("should return 404 if user doesn't have permission", async () => {
            _hasPermission.resolves(false);

            await expect(post("/locos", {})).to.be.eventually.rejectedWith(/404/);
        })

        it("should return a 500 error on DB exception", async () => {
            stub(_repo, "insert").rejects(new Error());

            await expect(post("/locos", {})).to.be.eventually.rejectedWith(/500/);
        })
    })

    describe("GET /locos/:id", () => {
        it("should return the loco specified from the DB", async () => {
            const loco = { id: 123, name: "test" };
            stub(_repo, "get").withArgs(123).resolves(loco as any);

            const result = await get("/locos/123");

            expect(result).to.eql(loco);
        })

        it("should return 404 if the loco isn't found", async () => {
            stub(_repo, "get").withArgs(123).resolves(undefined);

            await expect(get("/locos/123")).to.be.eventually.rejectedWith(/404/);
        })

        it("should return a 500 error on DB exception", async () => {
            stub(_repo, "get").rejects(new Error());

            await expect(get("/locos/123")).to.be.eventually.rejectedWith(/500/);
        })
    })

    describe("POST /locos/:id", () => {
        it("should update the specified loco", async () => {
            const update = stub(_repo, "update").resolves();
            const loco = { name: "bar" };

            await post("/locos/123", loco);

            expect(update.callCount).to.eql(1);
            expect(update.lastCall.args).to.eql([{id: 123, ...loco}]);
        })

        it("should return 404 if user doesn't have permission", async () => {
            _hasPermission.resolves(false);

            await expect(post("/locos/123", {})).to.be.eventually.rejectedWith(/404/);
        })

        it("should return a 500 error on DB exception", async () => {
            stub(_repo, "update").rejects(new Error());

            await expect(post("/locos/123", {})).to.be.eventually.rejectedWith(/500/);
        })
    })

    describe("DELETE /locos/:id", () => {
        it("should delete the specified loco from the DB", async () => {
            const delStub = stub(_repo, "delete").resolves();

            await del("/locos/123");

            expect(delStub.callCount).to.eql(1);
            expect(delStub.lastCall.args).to.eql([123]);
        })

        it("should return 404 if user doesn't have permission", async () => {
            _hasPermission.resolves(false);

            await expect(del("/locos/123")).to.be.eventually.rejectedWith(/404/);
        })

        it("should return a 500 error on DB exception", async () => {
            stub(_repo, "delete").rejects(new Error());

            await expect(del("/locos/123")).to.be.eventually.rejectedWith(/500/);
        })
    })

    describe("PUT /locoviews/:name/:id", () => {
        beforeEach(() => {
            _hasPermission.withArgs(Permissions.TRAIN_SELECT, "mock_session_id").resolves(true);
        })
    
        it("should add the specified loco to the specified view", async () => {
            await put("/locoview/On%20Track/3", "");
            await put("/locoview/On%20Track/7", "");

            const view = _locoViews.get(VIEW_ONTRACK) as LocoView;
            expect([...await view.locoIds]).to.eql([3, 7]);
        })

        it("should return 400 for unsupported view name", async () => {
            await expect(put("/locoview/test/3", {})).to.be.eventually.rejectedWith(/400/);
        })

        it("should return 404 if the user doesn't have permission", async () => {
            _hasPermission.withArgs(Permissions.TRAIN_SELECT, "mock_session_id").resolves(false);

            await expect(put("/locoview/On%20Track/3", "")).to.be.eventually.rejectedWith(/404/);
            const view = _locoViews.get(VIEW_ONTRACK) as LocoView;
            expect([...await view.locoIds]).to.eql([]);
        })

        it("should return a 500 error on view exception", async () => {
            const view = _locoViews.get(VIEW_ONTRACK) as LocoView;
            stub(view, "addLoco").rejects(new Error());

            await expect(put("/locoview/On%20Track/3", "")).to.be.eventually.rejectedWith(/500/);
        })
    })

    describe("DELETE /locoviews/:name/:id", () => {
        beforeEach(() => {
            _hasPermission.withArgs(Permissions.TRAIN_SELECT, "mock_session_id").resolves(true);
        })

        it("should remove the specified loco to the specified view", async () => {
            const view = _locoViews.get(VIEW_ONTRACK) as LocoView;
            await view.addLoco(3);
            await view.addLoco(7);
            await view.addLoco(11);

            await del("/locoview/On%20Track/3");

            expect([...await view.locoIds]).to.eql([7, 11]);
        })

        it("should have no effect on if the loco isn't in the view", async () => {
            const view = _locoViews.get(VIEW_ONTRACK) as LocoView;
            await view.addLoco(3);
            await view.addLoco(11);

            await del("/locoview/On%20Track/7");

            expect([...await view.locoIds]).to.eql([3, 11]);
        })

        it("should return 400 for unsupported view name", async () => {
            await expect(del("/locoview/test/3")).to.be.eventually.rejectedWith(/400/);
        })

        it("should return 404 if the user doesn't have permission", async () => {
            _hasPermission.withArgs(Permissions.TRAIN_SELECT, "mock_session_id").resolves(false);

            await expect(del("/locoview/On%20Track/3")).to.be.eventually.rejectedWith(/404/);
            const view = _locoViews.get(VIEW_ONTRACK) as LocoView;
            expect([...await view.locoIds]).to.eql([]);
        })

        it("should return a 500 error on view exception", async () => {
            const view = _locoViews.get(VIEW_ONTRACK) as LocoView;
            stub(view, "removeLoco").rejects(new Error());

            await expect(del("/locoview/On%20Track/3")).to.be.eventually.rejectedWith(/500/);
        })
    })
})
