import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import { stub, restore } from "sinon";
import * as request from "supertest";

import * as express from "express";
import { JSDOM } from "jsdom";
import { Express } from "express-serve-static-core";
import * as backupRouter from "./backupRouter";


describe("Backup Route", () => {
    let dom: JSDOM = null;
    let app: Express;

    beforeEach(async () => {
        app = express();
        app.use("/", await backupRouter.getRouter());
    })

    afterEach(() => {
        if (dom) {
            dom.window.close();
            dom = null;
        }
        restore();
    })

    describe("/", () => {
        it("should return the root page with all options", async () => {
            await request(app)
                .get("/")
                .expect(200);
        }).slow(500);
    });

    it("test", () => {
        dom = new JSDOM('<html><body><ul class="list"><li>Foo</li><li>Bar</li><li>Baz</li></ul></body></html>');
        const list = dom.window.document.querySelector(".list");

        expect(list.childNodes[1].textContent).to.equal("Bar");
    }).slow(400)
})