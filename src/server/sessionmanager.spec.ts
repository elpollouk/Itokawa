import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import { stub, restore } from "sinon";

import { SessionManager, ADMIN_USERNAME, ADMIN_PASSWORD_KEY, } from "./sessionmanager";
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

        it ("should return a valid session for valid credentails", async () => {
            const session = await sm.signIn(ADMIN_USERNAME, ADMIN_PASSWORD);
            expect(session).to.not.be.null.and.not.be.undefined;
            expect(session.isValid).to.be.true;
        })
    })
})