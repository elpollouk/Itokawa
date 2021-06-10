import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import { stub, restore } from "sinon";

import { SessionManager, Session } from "./sessionmanager";
import * as sessionManager from "./sessionmanager";
import { application } from "../application";
import { ConfigNode } from "../utils/config";
import { Database } from "../model/database";

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "abc123";

interface SessionRow {
    id: string,
    userId: number,
    expires: Date
}

describe("Session Manager", () => {
    let sm: SessionManager;
    let db: Database;

    async function fetchRow(sessionId: string): Promise<SessionRow> {
        const row = await db.get(`SELECT * FROM user_sessions WHERE id = "${sessionId}";`);
        if (!row) return null;
        return {
            id: row.id,
            userId: row.userId,
            expires: new Date(row.expires)
        }
    }

    async function addRow(sessionId: string, userId: number = sessionManager.USERID_ADMIN, expires?: Date): Promise<void> {
        expires = expires ?? new Date(new Date().getTime() + 10000);
        await db.run(`
            INSERT INTO user_sessions ( id, userId, expires )
            VALUES ( "${sessionId}", ${userId}, ${expires.getTime()} );
        `);
    }

    beforeEach(async () => {
        // Set admin password to "abc123"
        const config = new ConfigNode();
        config.set(sessionManager.ADMIN_PASSWORD_KEY, "$scrypt512$4$cB9UO4EnY6tNfbfgC3fR2WT9hSrul5PDYaeLVksG01lfYe7JJJyzO/Bph+6FnhsVZ/FZCQuE5KTUf4h6QOeb3t+CBMwGj9H+jRfvnK+x0mPSww");
        stub(application, "config").value(config);

        db = await Database.open(":memory:");
        sm = new SessionManager();
        await sm.init(db);
    })

    afterEach(async () => {
        restore();
        await sm.shutdown();
        await db.close();
    })

    describe("signIn", () => {
        it("should reject for invalid credentaials", async () => {
            await expect(sm.signIn("bob", "XXX")).to.be.eventually.rejectedWith("Invalid username or password");
        })

        it("should reject for valid username, incorrect password", async () => {
            await expect(sm.signIn(ADMIN_USERNAME, "XXX")).to.be.eventually.rejectedWith("Invalid username or password");
        })

        it("should reject a null username", async () => {
            await expect(sm.signIn(null, ADMIN_PASSWORD)).to.be.eventually.rejectedWith("Invalid username or password");
        })

        it("should reject a null password", async () => {
            await expect(sm.signIn(ADMIN_USERNAME, null)).to.be.eventually.rejectedWith("Invalid username or password");
        })

        it("should reject if password not set", async () => {
            application.config.set(sessionManager.ADMIN_PASSWORD_KEY, null);
            await expect(sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD)).to.be.eventually.rejectedWith("Invalid username or password");
        })

        it("should return a valid session for valid default admin user name", async () => {
            const session = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);

            expect(session).to.not.be.null.and.not.be.undefined;
            expect(session.isValid).to.be.true;
            expect(session.userId).to.equal(sessionManager.USERID_ADMIN);
        })

        it("should return a valid session for valid overridden admin user name", async () => {
            application.config.set(sessionManager.ADMIN_USERNAME_KEY, "bob");
            const session = await sm.signIn("bob", ADMIN_PASSWORD);

            expect(session).to.not.be.null.and.not.be.undefined;
            expect(session.isValid).to.be.true;
            expect(session.userId).to.equal(sessionManager.USERID_ADMIN);
        })

        it("should add all permissions and roles for admin user", async () => {
            const session = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);

            for (const role in sessionManager.ROLES) {
                expect(session.roles).to.contain(role);
                for (const permission of sessionManager.ROLES[role]) {
                    expect(session.permissions).to.contain(permission);
                }
            }
        })

        it("should restore existing sessions from the database", async () => {
            const expireDate = new Date(12345);
            await addRow("abcdef", 123, expireDate);

            const dbSession = await sm.getAndPingSession("abcdef");
            expect(dbSession.id).to.eql("abcdef");
            expect(dbSession.userId).to.eql(123);
            expect(dbSession.expires).to.be.greaterThanOrEqual(expireDate);

            for (const role in sessionManager.ROLES) {
                expect(dbSession.roles).to.contain(role);
                for (const permission of sessionManager.ROLES[role]) {
                    expect(dbSession.permissions).to.contain(permission);
                }
            }
        })
    })

    describe("signOut", () => {
        it("should expire valid sessions", async () => {
            const session = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);

            await sm.signOut(session.id);

            expect(session.isValid).to.be.false;
            expect(new Set<Session>(sm.getSessions())).to.be.empty;
        })

        it("should ignore invalid sessions", async () => {
            const session = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);

            await sm.signOut("ffgds");

            expect(session.isValid).to.be.true;
            expect(new Set<Session>(sm.getSessions())).to.not.be.empty;
        })

        it("should reject null session ids", async () => {
            await expect(sm.signOut(null)).to.be.eventually.rejectedWith("Null session id");
        })

        it("should delete record from database", async () => {
            const session = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);
            const sessionId = session.id;
            await sm.signOut(sessionId);

            expect(await fetchRow(sessionId)).to.be.null;
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
            application.config.set(sessionManager.SESSION_LENGTH_KEY, 1);
            const session = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);
            const initialExpiry = session.expires;

            application.config.set(sessionManager.SESSION_LENGTH_KEY, 10);

            expect((await sm.getAndPingSession(session.id)).expires).to.be.greaterThan(initialExpiry);
        })

        it("should return a guest session for invalid sessions", async () => {
            const session = await sm.getAndPingSession("0000000000000000");

            expect(session.isValid).to.be.true;
            expect(session.userId).to.equal(sessionManager.USERID_GUEST);
            expect(session.roles).to.have.keys(["GUEST"]);
            expect(session.permissions).to.be.empty;
        })

        it("should return a guest session for invalid session ids", async () => {
            const session = await sm.getAndPingSession("xxxx");

            expect(session.isValid).to.be.true;
            expect(session.userId).to.equal(sessionManager.USERID_GUEST);
            expect(session.roles).to.have.keys(["GUEST"]);
            expect(session.permissions).to.be.empty;
        })

        it("should return a guest session for a null session id", async () => {
            const session = await sm.getAndPingSession(null);

            expect(session.isValid).to.be.true;
            expect(session.userId).to.equal(sessionManager.USERID_GUEST);
            expect(session.roles).to.have.keys(["GUEST"]);
            expect(session.permissions).to.be.empty;
        })

        it("should return a guest session for expired sessions", async () => {
            const session1 = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);
            session1.expire();

            const session2 = await sm.getAndPingSession(session1.id);

            expect(session2.isValid).to.be.true;
            expect(session2.userId).to.equal(sessionManager.USERID_GUEST);
            expect(session2.roles).to.have.keys(["GUEST"]);
            expect(session2.permissions).to.be.empty;
        })
    })

    describe("ping", () => {
        it("should update valid session", async () => {
            application.config.set(sessionManager.SESSION_LENGTH_KEY, 1);
            const session = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);
            const initialExpiry = session.expires;
            application.config.set(sessionManager.SESSION_LENGTH_KEY, 10);

            await expect(sm.ping(session.id)).to.be.eventually.true;
            expect(session.expires).to.be.greaterThan(initialExpiry);
        })

        it("should return false for a guest session", async () => {
            await expect(sm.ping("sfgfff")).to.be.eventually.false;
        })

        it("should return false for an undefined session", async () => {
            await expect(sm.ping(undefined)).to.be.eventually.false;
        })

        it("should return false for an expired session", async () => {
            const session = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);
            await session.expire();

            await expect(sm.ping(session.id)).to.be.eventually.false;
        })

        it("should return true if no admin has been configured", async () => {
            application.config.set(sessionManager.ADMIN_PASSWORD_KEY, null);
            expect(await sm.ping("test")).to.be.true;
        })

        it("should ping sessions in the database", async () => {
            await addRow("foo");

            expect(await sm.ping("foo")).to.be.true;
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

    describe("clearExpired", () => {
        it("should not remove valid sessions", async () => {
            const session1 = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);
            const session2 = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);

            await sm.clearExpired();

            const sessions = new Set<Session>(sm.getSessions());
            expect(sessions.size).to.eql(2);
            expect(sessions).to.contain(session1);
            expect(sessions).to.contain(session2);
        })

        it("should remove expired sessions", async () => {
            const session1 = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);
            const session2 = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);
            await session1.expire();

            await sm.clearExpired();

            const sessions = new Set<Session>(sm.getSessions());
            expect(sessions.size).to.eql(1);
            expect(sessions).to.contain(session2);
        })

        it("should remove expired items from the database", async () => {
            await addRow("qwerty", sessionManager.USERID_ADMIN, new Date(1234));
            await addRow("asdfgh", sessionManager.USERID_ADMIN);
            await sm.clearExpired();

            expect(await sm.getSession("qwerty")).to.be.null;
            expect(await sm.getSession("asdfgh")).to.be.not.null;
        })
    })

    describe("clearAll", () => {
        it("should remove all sessions from the cache", async () => {
            const session1 = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);
            const initialSessionId1 = session1.id;
            const session2 = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);
            const initialSessionId2 = session2.id;
            await session1.expire();

            await sm.clearAll();

            expect(await sm.getSession(initialSessionId1)).to.be.null;
            expect(await sm.getSession(initialSessionId2)).to.be.null;
        })

        it("should remove all sessions from the database", async () => {
            await addRow("abc");
            await addRow("def");
            await addRow("ghi");

            await sm.clearAll();

            expect(await sm.getSession("abc")).to.be.null;
            expect(await sm.getSession("def")).to.be.null;
            expect(await sm.getSession("ghi")).to.be.null;
        })
    })

    describe("hasPermission", () => {
        it("should return true for signed in admin", async () => {
            const session = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);

            expect(await sm.hasPermission(sessionManager.Permissions.APP_UPDATE, session.id)).to.be.true;
        })

        it("should return false for expired sessions", async () => {
            const session = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);
            await session.expire();

            expect(await sm.hasPermission(sessionManager.Permissions.APP_UPDATE, session.id)).to.be.false;
        })

        it("should return false for invalid/guest essions", async () => {
            expect(await sm.hasPermission(sessionManager.Permissions.APP_UPDATE, "dsfdsf")).to.be.false;
        })
    })

    describe("Session", () => {
        describe("construct", () => {
            it("should create a valid session", () => {
                const session = new Session(123);

                expect(session.id).to.match(/^[a-f0-9]{16}$/);
                expect(session.isValid).to.be.true;
                expect(session.userId).to.equal(123);
                expect(new Date()).to.be.lessThan(session.expires);
                expect(session.roles).to.be.empty;
                expect(session.permissions).to.be.empty;
            })

            it("should have a unique session id for each session", () => {
                const session1 = new Session(0);
                const session2 = new Session(0);

                expect(session1.id).to.not.eql(session2.id);
            })

            it("should be possible to set expiry days from config", () => {
                application.config.set(sessionManager.SESSION_LENGTH_KEY, -1); // This should force session to be expired
                const session = new Session(0);

                expect(session.isValid).to.be.false;
            })
        })

        describe("ping", () => {
            it ("should update expiry time", () => {
                application.config.set(sessionManager.SESSION_LENGTH_KEY, 1);
                const session = new Session(0);
                const initialExpiry = session.expires;

                application.config.set(sessionManager.SESSION_LENGTH_KEY, 10);
                session.ping();

                expect(session.expires).to.be.greaterThan(initialExpiry);
            })

            it("should debounce the request", async () => {
                application.config.set(sessionManager.SESSION_LENGTH_KEY, -1);
                const session1 = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);
                const initialExpiry = session1.expires.getTime();
                application.config.set(sessionManager.SESSION_LENGTH_KEY, 10);

                await session1.ping();

                expect(session1.expires.getTime()).to.be.greaterThan(initialExpiry);
                const row = await db.get(`SELECT * FROM user_sessions WHERE id = "${session1.id}";`);
                expect(row.expires).to.equal(initialExpiry);
            })
        })

        describe("expire", () => {
            it("should expire a valid session", async () => {
                const session = new Session(0);

                await session.expire();

                expect(session.isValid).to.be.false;
                expect(session.expires).to.eql(new Date(0));
            })

            it("should be safe to expire a session multiple times", async () => {
                const session = new Session(0);

                await session.expire();
                await session.expire();

                expect(session.isValid).to.be.false;
                expect(session.expires).to.eql(new Date(0));
            })

            it("should remove record from database", async () => {
                const session = new Session(123);
                const sessionId = session.id;

                await session.expire();

                expect(await fetchRow(sessionId)).to.be.null;
            })
        })

        describe("addRole", () => {
            it("should add the right permissions for a role", () => {
                const session = new Session(0);

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
                expect(session.userId).to.equal(sessionManager.USERID_GUEST);
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

        describe("No admin password configured", () => {
            it("should have all permissions", async () => {
                application.config.set(sessionManager.ADMIN_PASSWORD_KEY, null);
                const session = await sm.getAndPingSession("safgsfg");

                for (const permission in sessionManager.Permissions) {
                    expect(session.permissions).to.contain(permission);
                }

                expect(await sm.hasPermission(sessionManager.Permissions.SERVER_UPDATE, "dgsdsf")).to.be.true;
            })
        })
    })
})
