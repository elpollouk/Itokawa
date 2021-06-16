import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import { stub, restore, SinonStub } from "sinon";
import { JSDOM } from "jsdom";
import * as supertest from "supertest";

import * as express from "express";
import { Express } from "express-serve-static-core";
import * as cookieParser from "cookie-parser";
import { requestGet, requestPost } from "../../utils/testUtils";
import * as authRouter from "./authRouter";
import { PATH_AUTH, PATH_MAIN } from "../../common/constants";
import { application } from "../../application";

describe("authRouter", () => {
    let _dom: JSDOM = null;
    let _app: Express;
    let _getSessionStub: SinonStub;

    async function get(path: string, redirectTo?: string) : Promise<supertest.Response> {
        const response = await requestGet(_app, path, redirectTo);
        _dom = new JSDOM(response.text);
        return response;
    }

    async function post(path: string, filename: string, data: Buffer, redirectTo?: string) : Promise<string> {
        const response = await requestPost(_app, path, filename, data, redirectTo);
        _dom = new JSDOM(response.text);
        return response.text;
    }

    function querySelector<E extends Element = Element>(query: string): E {
        return _dom.window.document.querySelector(query);
    }

    beforeEach(async () => {
        _app = express();
        _app.set("view engine", "pug");
        _app.set("views", "./views");
        _app.use(cookieParser());
        _app.use("/", await authRouter.getRouter());

        _getSessionStub = stub(application.sessionManager, "getSession").resolves(null);
    })

    afterEach(() => {
        if (_dom) {
            _dom.window.close();
            _dom = null;
        }
        restore();
    })

    describe("/", () => {
        it("should return the login page for a simple get", async () => {
            const response = await get("/");

            expect(response.get("Set-Cookie")).to.eql(["sessionId=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT"]);

            const form = querySelector<HTMLFormElement>("form");
            expect(form.method).to.equal("post");
            expect(form.action).to.equal(PATH_AUTH);
            const inputs = form.querySelectorAll<HTMLInputElement>("input");
            expect(inputs.length).to.equal(3);
            expect(inputs[0].type).to.equal("text");
            expect(inputs[0].name).to.equal("username");
            expect(inputs[1].type).to.equal("password");
            expect(inputs[1].name).to.equal("password");
            expect(inputs[2].type).to.equal("submit");
            expect(inputs[2].value).to.equal("Sign In");
        }).slow(2000).timeout(3000)

        it("should return the login page if session is invalid", async () => {
            _getSessionStub.resolves({
                isValid: false,
            });
            const response = await get("/");

            expect(response.get("Set-Cookie")).to.eql(["sessionId=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT"]);

            const form = querySelector<HTMLFormElement>("form");
            expect(form.method).to.equal("post");
            expect(form.action).to.equal(PATH_AUTH);
            const inputs = form.querySelectorAll<HTMLInputElement>("input");
            expect(inputs.length).to.equal(3);
            expect(inputs[0].type).to.equal("text");
            expect(inputs[0].name).to.equal("username");
            expect(inputs[1].type).to.equal("password");
            expect(inputs[1].name).to.equal("password");
            expect(inputs[2].type).to.equal("submit");
            expect(inputs[2].value).to.equal("Sign In");
        }).slow(2000).timeout(3000)

        it("should redirect on an already signed in session", async () => {
            _getSessionStub.resolves({
                id: "foo",
                isValid: true,
                ping: stub(),
                expires: new Date(1234567890)
            });
            const response = await get("/", PATH_MAIN);

            expect(response.get("Set-Cookie")).to.eql(["sessionId=foo; Path=/; Expires=Thu, 15 Jan 1970 06:56:07 GMT"]);
        }).slow(2000).timeout(3000)

        it("should result in a 500 error on exception", async () => {
            _getSessionStub.rejects(new Error("Test error"));
            await expect(get("/")).to.be.eventually.rejectedWith(/500/);
        })
    })
})