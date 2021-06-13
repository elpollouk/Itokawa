import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import { stub, restore, SinonStub } from "sinon";
import * as request from "supertest";
import { JSDOM } from "jsdom";

import * as express from "express";
import { Express } from "express-serve-static-core";
import * as cookieParser from "cookie-parser";
import * as fs from "fs";
import { application } from "../../application";
import { Permissions } from "../sessionmanager";
import * as backupRouter from "./backupRouter";


describe("Backup Route", () => {
    let _dom: JSDOM = null;
    let _app: Express;
    let _backupList: string[] = null;
    let _fsExists: SinonStub = null;
    let _smHasPermission: SinonStub = null;

    async function get(path: string) : Promise<void> {
        const response = await request(_app)
            .get(path)
            .set("Cookie", ["sessionId=mock_session"])
            .expect(200);
        _dom = new JSDOM(response.text);
    }

    function querySelector<E extends Element = Element>(query: string): E {
        return _dom.window.document.querySelector(query);
    }

    beforeEach(async () => {
        _backupList = [];

        _app = express();
        _app.set('view engine', 'pug');
        _app.set('views','./views');
        _app.use(cookieParser());
        _app.use("/", await backupRouter.getRouter());

        stub(application, "getDataPath").returns(".test.backups/backups");
        _fsExists = stub(fs, "existsSync").withArgs(".test.backups/backups").returns(true);
        stub(fs.promises, "readdir").callsFake(() => Promise.resolve(_backupList) as any);
        _smHasPermission = stub(application.sessionManager, "hasPermission")
            .withArgs(Permissions.SERVER_BACKUP, "mock_session")
            .resolves(true);
    })

    afterEach(() => {
        if (_dom) {
            _dom.window.close();
            _dom = null;
        }
        restore();
    })

    describe("/", () => {
        it("should return the root page with a 'Create Backups' button", async () => {
            await get("/");

            const button = querySelector<HTMLAnchorElement>(".linkButton");
            expect(button.href).to.equal("createBackup");
        }).slow(2000).timeout(3000)

        it("should return an empty list of backups if the backup directory doesn't exist", async () => {
            _fsExists.returns(false);

            await get("/");

            const backupList = querySelector(".backups");
            expect(backupList.childNodes.length).to.equal(0);
        }).slow(2000).timeout(3000)

        it("should return an empty list of backups if the backup directory is empty", async () => {
            _backupList = [];

            await get("/");

            const backupList = querySelector(".backups");
            expect(backupList.childNodes.length).to.equal(0);
        }).slow(2000).timeout(3000)

        it("should return a populated list of backups if the backup directory contains any zips", async () => {
            _backupList = [
                "backup1.zip",
                "backup2",
                "backup3.zip",
                "spurious.txt"
            ];

            await get("/");


            function verifyBackUpEntry(expectedName: string, element: Element) {
                expectedName += ".zip";
                const backupName = element.querySelector(".title").textContent;
                expect(backupName).to.eql(expectedName);

                const buttons = element.querySelectorAll<HTMLAnchorElement>(".linkButton");
                expect(buttons[0].href).to.equal(`restore/${expectedName}`);
                expect(buttons[1].href).to.equal(`delete/${expectedName}`);
            }

            const backupList = querySelector(".backups");
            expect(backupList.children.length).to.equal(2);
            verifyBackUpEntry("backup1", backupList.children[0]);
            verifyBackUpEntry("backup3", backupList.children[1]);

        }).slow(2000).timeout(3000)

        it("should reject if has no permission", async () => {
            _smHasPermission.resolves(false);
            await expect(get("/")).to.eventually.be.rejected;
        })
    });
})
