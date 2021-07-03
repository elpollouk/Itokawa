import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import { stub, restore, SinonStub } from "sinon";

import * as express from "express";
import * as cookieParser from "cookie-parser";
import { requestGet, requestPost, requestDelete } from "../../utils/testUtils";
import { getRouter } from "./apiRouter";
import { application } from "../../application";
import { LocoRepository } from "../../model/locoRepository";
import { Permissions } from "../sessionmanager";

describe("apiRouter", async () => {
    let _app: express.Express;
    let _repo: LocoRepository;
    let _hasPermission: SinonStub;

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

    async function del(path: string): Promise<void> {
        const response = await requestDelete(_app, path, {
            sessionId: "mock_session_id"
        });
    }

    beforeEach(async () => {
        _repo = new LocoRepository(null);
        const db = {
            openRepository: stub().resolves(_repo)
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

    describe("GET /locos", () => {
        it("should return the results from the database", async () => {
            stub(_repo, "list").resolves([]);

            const locos = await get("/locos");

            expect(locos).to.eql([]);
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
            stub(_repo, "get").withArgs(123).resolves(null);

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
})
