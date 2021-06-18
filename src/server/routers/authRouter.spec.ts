import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import { stub, restore, SinonStub } from "sinon";
import { JSDOM } from "jsdom";
import * as supertest from "supertest";

import * as express from "express";
import { Express } from "express-serve-static-core";
import * as cookieParser from "cookie-parser";
import { requestGet, requestPost, RequestOptions } from "../../utils/testUtils";
import * as authRouter from "./authRouter";
import { PATH_AUTH, PATH_MAIN } from "../../common/constants";
import { application } from "../../application";
import { Permissions, Session } from "../sessionmanager";

describe("authRouter", () => {
    let _dom: JSDOM = null;
    let _app: Express;
    let _getSessionStub: SinonStub;

    async function get(path: string, options?: RequestOptions) : Promise<supertest.Response> {
        const response = await requestGet(_app, path, options);
        _dom = new JSDOM(response.text);
        return response;
    }

    async function post(path: string, username: string, password: string, expectRedirectTo?: string) : Promise<supertest.Response> {
        const response = await requestPost(_app, path, {
            expectRedirectTo: expectRedirectTo,
            formdata: {
                username: username,
                password: password
            }
        });
        _dom = new JSDOM(response.text);
        return response;
    }

    function querySelector<E extends Element = Element>(query: string): E {
        return _dom.window.document.querySelector(query);
    }

    function verifySignInDom() {
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

    describe("GET /", () => {
        it("should return the login page for a simple get", async () => {
            const response = await get("/");

            expect(_getSessionStub.callCount).to.eql(1);
            expect(_getSessionStub.lastCall.args).to.eql([undefined]);
            expect(response.get("Set-Cookie")).to.eql(["sessionId=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT"]);

            verifySignInDom();
        }).slow(2000).timeout(3000)

        it("should return the login page if session is invalid", async () => {
            _getSessionStub.resolves({
                isValid: false,
            });
            const response = await get("/", {
                sessionId: "mock_session_id"
            });

            expect(_getSessionStub.callCount).to.eql(1);
            expect(_getSessionStub.lastCall.args).to.eql(["mock_session_id"]);
            expect(response.get("Set-Cookie")).to.eql(["sessionId=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT"]);

            verifySignInDom();
        }).slow(2000).timeout(3000)

        it("should redirect on an already signed in session", async () => {
            _getSessionStub.resolves({
                id: "foo",
                isValid: true,
                ping: stub(),
                expires: new Date(1234567890)
            });
            const response = await get("/", {
                sessionId: "mock_session_id",
                expectRedirectTo: PATH_MAIN
            });

            expect(_getSessionStub.callCount).to.eql(1);
            expect(_getSessionStub.lastCall.args).to.eql(["mock_session_id"]);
            expect(response.get("Set-Cookie")).to.eql(["sessionId=foo; Path=/; Expires=Thu, 15 Jan 1970 06:56:07 GMT"]);
        }).slow(2000).timeout(3000)

        it("should result in a 500 error on exception", async () => {
            _getSessionStub.rejects(new Error("Test error"));
            await expect(get("/")).to.be.eventually.rejectedWith(/500/);
        })
    })

    describe("POST /", () => {
        it("should setup new session on succesful sign in", async () => {
            stub(application.sessionManager, "signIn")
                .withArgs("user", "pass")
                .resolves({
                    id: "foo",
                    expires: new Date(1234567890)
                } as Session);

            const response = await post("/", "user", "pass", PATH_MAIN);

            expect(response.get("Set-Cookie")).to.eql(["sessionId=foo; Path=/; Expires=Thu, 15 Jan 1970 06:56:07 GMT"]);
        }).slow(2000).timeout(3000)

        it("should return an error message on invalid credentials", async () => {
            stub(application.sessionManager, "signIn")
                .rejects(new Error("Invalid credentials"));

            await post("/", "user", "pass");

            const errorMessage = querySelector(".errorMessage");
            expect(errorMessage.textContent).to.equal("Error: Invalid credentials");
            verifySignInDom();
            const form = querySelector<HTMLFormElement>("form");
            const inputs = form.querySelectorAll<HTMLInputElement>("input");
            expect(inputs[0].value).to.equal("user");
            expect(inputs[1].value).to.equal("");
        }).slow(2000).timeout(3000)

        it("should cope with missing user name", async () => {
            stub(application.sessionManager, "signIn")
                .rejects(new Error("Invalid credentials"));

            await post("/", null, "pass");

            const errorMessage = querySelector(".errorMessage");
            expect(errorMessage.textContent).to.equal("Error: Invalid credentials");
            verifySignInDom();
            const form = querySelector<HTMLFormElement>("form");
            const inputs = form.querySelectorAll<HTMLInputElement>("input");
            expect(inputs[0].value).to.equal("");
            expect(inputs[1].value).to.equal("");
        }).slow(2000).timeout(3000)

        it("should cope with missing password", async () => {
            stub(application.sessionManager, "signIn")
                .rejects(new Error("Invalid credentials"));

            await post("/", "user", null);

            const errorMessage = querySelector(".errorMessage");
            expect(errorMessage.textContent).to.equal("Error: Invalid credentials");
            verifySignInDom();
            const form = querySelector<HTMLFormElement>("form");
            const inputs = form.querySelectorAll<HTMLInputElement>("input");
            expect(inputs[0].value).to.equal("user");
            expect(inputs[1].value).to.equal("");
        }).slow(2000).timeout(3000)
    })

    describe("GET /logout", () => {
        it("should attempt sign out if session provided", async () => {
            const signOutStub = stub(application.sessionManager, "signOut")
                .resolves();
            
            const response = await get("/logout", {
                sessionId: "mock_session_id",
                expectRedirectTo: PATH_MAIN
            });

            expect(signOutStub.callCount).to.eql(1);
            expect(signOutStub.lastCall.args).to.eql(["mock_session_id"]);
            expect(response.get("Set-Cookie")).to.eql(["sessionId=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT"]);
        }).slow(2000).timeout(3000)

        it("should redirect even if there is no session", async () => {
            const response = await get("/logout", {
                expectRedirectTo: PATH_MAIN
            });
            expect(response.get("Set-Cookie")).to.eql(["sessionId=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT"]);
        }).slow(2000).timeout(3000)
    })

    describe("GET /clearAllSessions", () => {
        it("should clear all sessions if session has permission", async () => {
            stub(application.sessionManager, "hasPermission")
                .withArgs(Permissions.SESSION_MANAGE, "mock_session_id")
                .resolves(true);
            const clearAllStub = stub(application.sessionManager, "clearAll").resolves();

            await get("/clearAllSessions", {
                sessionId: "mock_session_id"
            });

            expect(clearAllStub.callCount).to.eql(1);
        }).slow(2000).timeout(3000)

        it("should handle error from clearing sessions", async () => {
            stub(application.sessionManager, "hasPermission")
                .withArgs(Permissions.SESSION_MANAGE, "mock_session_id")
                .resolves(true);
            const clearAllStub = stub(application.sessionManager, "clearAll").rejects(new Error());

            await get("/clearAllSessions", {
                sessionId: "mock_session_id"
            });

            expect(clearAllStub.callCount).to.eql(1);
        }).slow(2000).timeout(3000)

        it("shoulr return 404 if session doesn't have permission", async () => {
            stub(application.sessionManager, "hasPermission").resolves(false);

            await expect(get("/clearAllSessions", {
                sessionId: "mock_session_id"
            })).to.be.eventually.rejectedWith(/404/);
        }).slow(2000).timeout(3000)
    })

    describe("GET /clearExpiredSessions", () => {
        it("should clear all sessions if session has permission", async () => {
            stub(application.sessionManager, "hasPermission")
                .withArgs(Permissions.SESSION_MANAGE, "mock_session_id")
                .resolves(true);
            const clearAllStub = stub(application.sessionManager, "clearExpired").resolves();

            await get("/clearExpiredSessions", {
                sessionId: "mock_session_id"
            });

            expect(clearAllStub.callCount).to.eql(1);
        }).slow(2000).timeout(3000)

        it("should handle error from clearing sessions", async () => {
            stub(application.sessionManager, "hasPermission")
                .withArgs(Permissions.SESSION_MANAGE, "mock_session_id")
                .resolves(true);
            const clearAllStub = stub(application.sessionManager, "clearExpired").rejects(new Error());

            await get("/clearExpiredSessions", {
                sessionId: "mock_session_id"
            });

            expect(clearAllStub.callCount).to.eql(1);
        }).slow(2000).timeout(3000)

        it("shoulr return 404 if session doesn't have permission", async () => {
            stub(application.sessionManager, "hasPermission").resolves(false);

            await expect(get("/clearExpiredSessions", {
                sessionId: "mock_session_id"
            })).to.be.eventually.rejectedWith(/404/);
        }).slow(2000).timeout(3000)
    })
})