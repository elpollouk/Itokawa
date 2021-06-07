import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import { stub, restore } from "sinon";

import { SessionManager, ADMIN_USERNAME, ADMIN_PASSWORD_KEY, Session, SESSION_LENGTH_KEY, } from "./sessionmanager";
import * as sessionManager from "./sessionmanager";
import { application } from "../application";
import { ConfigNode } from "../utils/config";

const ADMIN_PASSWORD = "abc123";

describe("Session Manager", () => {
    let sm: SessionManager;

    beforeEach(() => {
        // Set admin password to "abc123"
        const config = new ConfigNode();
        config.set(ADMIN_PASSWORD_KEY, "$scrypt512$16384$ctYA6wtQEVXMiEMQm3oeXu775kFGLRI+zRE7Ww3+coGlFPPpgfMkeH18NGPgMoOXl7qtCqVSi+CEDw6lCFsHaAuYho3SLQBWxibEZRyf47ra3g");
        stub(application, "config").value(config);
        sm = new SessionManager();
    })

    afterEach(async () => {
        restore();
    })

    describe("signIn", () => {
        it ("should reject for invalid credentaials", async () => {
            await expect(sm.signIn("invalid", "XXX")).to.be.eventually.rejectedWith("Invalid username or password");
        })

        it ("should reject for valid username, incorrect password", async () => {
            await expect(sm.signIn(ADMIN_USERNAME, "XXX")).to.be.eventually.rejectedWith("Invalid username or password");
        })

        it ("should reject a null username", async () => {
            await expect(sm.signIn(null, ADMIN_PASSWORD)).to.be.eventually.rejectedWith("Invalid username or password");
        })

        it ("should reject a null password", async () => {
            await expect(sm.signIn(ADMIN_USERNAME, null)).to.be.eventually.rejectedWith("Invalid username or password");
        })

        it ("should reject if password not set", async () => {
            application.config.set(ADMIN_PASSWORD_KEY, null);
            await expect(sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD)).to.be.eventually.rejectedWith("Invalid username or password");
        })

        it ("should return a valid session for valid credentails", async () => {
            const session = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);

            expect(session).to.not.be.null.and.not.be.undefined;
            expect(session.isValid).to.be.true;
        })

        it ("should add all permissions and roles for admin user", async () => {
            const session = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);

            for (const role in sessionManager.ROLES) {
                expect(session.roles).to.contain(role);
                for (const permission of sessionManager.ROLES[role]) {
                    expect(session.permissions).to.contain(permission);
                }
            }
        })
    })

    describe("getAndPingSession", () => {
        it("should return valid sessions", async () => {
            const session1 = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);
            const session2 = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);

            expect((await sm.getAndPingSession(session1.id))).to.equal(session1);
            expect((await sm.getAndPingSession(session2.id))).to.equal(session2);
        })

        it("should update session expiry", async () => {
            application.config.set(SESSION_LENGTH_KEY, 1);
            const session = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);
            const initialExpiry = session.expires;

            application.config.set(SESSION_LENGTH_KEY, 10);

            expect((await sm.getAndPingSession(session.id)).expires).to.be.greaterThan(initialExpiry);
        })

        it("should return a guest session for invalid sessions", async () => {
            const session = await sm.getAndPingSession("0000000000000000");

            expect(session.isValid).to.be.true;
            expect(session.roles).to.have.keys(["GUEST"]);
            expect(session.permissions).to.be.empty;
        })

        it("should return a guest session for invalid session ids", async () => {
            const session = await sm.getAndPingSession("xxxx");

            expect(session.isValid).to.be.true;
            expect(session.roles).to.have.keys(["GUEST"]);
            expect(session.permissions).to.be.empty;
        })

        it("should reject a null session id", async () => {
            await expect(sm.getAndPingSession(null)).to.be.eventually.rejectedWith("Null session id");
        })

        it("should return a guest session for expired sessions", async () => {
            const session1 = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);
            session1.expire();

            const session2 = await sm.getAndPingSession(session1.id);

            expect(session2.isValid).to.be.true;
            expect(session2.roles).to.have.keys(["GUEST"]);
            expect(session2.permissions).to.be.empty;
        })
    })

    describe("getSessions", () => {
        it("should return valid sessions", async () => {
            const session1 = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);
            const session2 = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);

            const sessions = new Set<Session>(sm.getSessions());

            expect(sessions.size).to.eql(2);
            expect(sessions).to.contain(session1);
            expect(sessions).to.contain(session2);
        })

        it("should contain expired sessions", async () => {
            const session1 = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);
            const session2 = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);
            await session1.expire();


            const sessions = new Set<Session>(sm.getSessions());

            expect(sessions.size).to.eql(2);
            expect(sessions).to.contain(session1);
            expect(sessions).to.contain(session2);
        })
    })

    describe("removeExpired", () => {
        it("should not remove valid sessions", async () => {
            const session1 = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);
            const session2 = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);

            await sm.removeExpired();

            const sessions = new Set<Session>(sm.getSessions());
            expect(sessions.size).to.eql(2);
            expect(sessions).to.contain(session1);
            expect(sessions).to.contain(session2);
        })

        it("should remove expired sessions", async () => {
            const session1 = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);
            const session2 = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);
            await session1.expire();

            await sm.removeExpired();

            const sessions = new Set<Session>(sm.getSessions());
            expect(sessions.size).to.eql(1);
            expect(sessions).to.contain(session2);
        })
    })

    describe("Session", () => {
        describe("construct", () => {
            it("should create a valid session", () => {
                const session = new Session();

                expect(session.id).to.match(/^[a-f0-9]{16}$/);
                expect(session.isValid).to.be.true;
                expect(new Date()).to.be.lessThan(session.expires);
                expect(session.roles).to.be.empty;
                expect(session.permissions).to.be.empty;
            })

            it("should have a unique session id for each session", () => {
                const session1 = new Session();
                const session2 = new Session();

                expect(session1.id).to.not.eql(session2.id);
            })

            it("should be possible to set expiry days from config", () => {
                application.config.set(SESSION_LENGTH_KEY, -1); // This should force session to be expired
                const session = new Session();

                expect(session.isValid).to.be.false;
            })
        })

        describe("ping", () => {
            it ("should update expiry time", () => {
                application.config.set(SESSION_LENGTH_KEY, 1);
                const session = new Session();
                const initialExpiry = session.expires;

                application.config.set(SESSION_LENGTH_KEY, 10);
                session.ping();

                expect(session.expires).to.be.greaterThan(initialExpiry);
            })
        })

        describe("expire", () => {
            it("should expire a valid session", async () => {
                const session = new Session();

                await session.expire();

                expect(session.isValid).to.be.false;
                expect(session.expires).to.eql(new Date(0));
            })

            it("should be safe to expire a session multiple times", async () => {
                const session = new Session();

                await session.expire();
                await session.expire();

                expect(session.isValid).to.be.false;
                expect(session.expires).to.eql(new Date(0));
            })
        })

        describe("addRole", () => {
            it("should add the right permissions for a role", () => {
                const session = new Session();

                session.addRole("TRAIN_ADMIN");

                expect(session.roles).to.have.keys(["TRAIN_ADMIN"]);
                expect(session.permissions).to.have.keys(sessionManager.ROLES["TRAIN_ADMIN"]);
            })
        })
    })

    describe("Guest Session", () => {
        describe("construct", () => {
            it("should create a valid session", async () => {
                const session = await sm.getAndPingSession("dsfsdfa");

                expect(session.isValid).to.be.true;
                expect(session.expires).to.be.greaterThan(new Date());
                expect(session.id).to.not.be.null.and.to.not.be.undefined;
                expect(session.roles).to.have.keys(["GUEST"]);
                expect(session.permissions).to.be.empty;
            })
        })

        describe("ping", () => {
            it("should not alter the expiry date", async () => {
                const session = await sm.getAndPingSession("dsfsdfa");
                const intialExpiryDate = session.expires;

                await session.ping();

                expect(session.expires).to.eql(intialExpiryDate);
            })
        })

        describe("expire", () => {
            it("should be rejected", async () => {
                const session = await sm.getAndPingSession("dsfsdfa");

                await expect(session.expire()).to.be.eventually.rejectedWith("Attempt to expire guest session");
            })
        })

        describe("addRole", () => {
            it("should be rejected", async () => {
                const session = await sm.getAndPingSession("safgsfg");

                expect(() => session.addRole("SERVER_ADMIN")).to.throw("Attempt to modify guest permissions");
            })
        })
    })
})
