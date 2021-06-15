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
import { cleanDir } from "../../utils/testUtils";
import * as backup from "../../utils/backup";
import { application } from "../../application";
import { Permissions } from "../sessionmanager";
import * as backupRouter from "./backupRouter";
import { PATH_BACKUP } from "../../common/constants";
import { Database } from "../../model/database";

const Q_CLASS_LINKBUTTON = ".linkButton";
const Q_CLASS_MESSAGE = ".message";
const Q_CLASS_ERROR = ".errorMessage";

const TEST_DIR = ".test.backups";

describe("backupRouter", () => {
    let _dom: JSDOM = null;
    let _app: Express;
    let _smHasPermission: SinonStub = null;
    let _getDataPath: SinonStub = null;

    async function get(path: string) : Promise<string> {
        const response = await request(_app)
            .get(path)
            .set("Cookie", ["sessionId=mock_session"])
            .expect(200);

        _dom = new JSDOM(response.text);
        return response.text;
    }

    async function post(path: string, filename: string, data: Buffer, redirectTo?: string) : Promise<string> {
        const req = request(_app)
            .post(path)
            .set("Cookie", ["sessionId=mock_session"])
            .attach("file", data, filename);

        if (redirectTo) {
            req.expect(302).expect("Location", redirectTo);
        }
        else {
            req.expect(200);
        }

        const response = await req;
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
        _app.use("/", await backupRouter.getRouter());

        _getDataPath = stub(application, "getDataPath")
            .withArgs().returns(TEST_DIR)
            .withArgs("backups").returns(`${TEST_DIR}/backups`);
        _smHasPermission = stub(application.sessionManager, "hasPermission")
            .withArgs(Permissions.SERVER_BACKUP, "mock_session")
            .resolves(true);

        cleanDir(TEST_DIR);
        backupRouter.setDownloadDir(TEST_DIR);
    })

    afterEach(() => {
        if (_dom) {
            _dom.window.close();
            _dom = null;
        }
        restore();
    })

    describe("/", () => {
        let _backupList: string[] = null;
        let _fsExists: SinonStub = null;

        beforeEach(() => {
            _backupList = [];
            _fsExists = stub(fs, "existsSync").withArgs(`${TEST_DIR}/backups`).returns(true);
            stub(fs.promises, "readdir").callsFake(() => Promise.resolve(_backupList) as any);
        });

        it("should return the root page with a 'Create Backups' button", async () => {
            await get("/");

            const button = querySelector<HTMLAnchorElement>(Q_CLASS_LINKBUTTON);
            expect(button.href).to.equal("/backup/create");
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

                const buttons = element.querySelectorAll<HTMLAnchorElement>(Q_CLASS_LINKBUTTON);
                expect(buttons[0].href).to.equal(`/backup/restore/${expectedName}`);
                expect(buttons[1].href).to.equal(`/backup/delete/${expectedName}`);
            }

            const backupList = querySelector(".backups");
            expect(backupList.children.length).to.equal(2);
            verifyBackUpEntry("backup1", backupList.children[0]);
            verifyBackUpEntry("backup3", backupList.children[1]);

        }).slow(2000).timeout(3000)

        it("should accept a file upload", async () => {
            const buffer = Buffer.from("Mock backup");
            await post("/", "c:\\fake_path\\uploaded_backup.zip", buffer, PATH_BACKUP);

            const fileContent = fs.readFileSync(`${TEST_DIR}/uploaded_backup.zip`);
            expect(fileContent).to.eql(buffer);
        }).slow(2000).timeout(3000)

        it("should reject any already existing zip file", async () => {
            _fsExists.withArgs(`${TEST_DIR}/uploaded_backup.zip`).returns(true);

            const buffer = Buffer.from("Invalid backup");
            await post("/", "c:\\fake_path\\uploaded_backup.zip", buffer);

            const message = querySelector(Q_CLASS_MESSAGE).textContent;
            expect(message).to.equal("");
            const error = querySelector(Q_CLASS_ERROR).textContent;
            expect(error).to.equal("Error: Backup already exists");
        }).slow(2000).timeout(3000)

        it("should reject if invalid file name for zip", async () => {
            const buffer = Buffer.from("Mock backup");
            await post("/", "c:\\fake_path\\new backup.zip", buffer);

            const message = querySelector(Q_CLASS_MESSAGE).textContent;
            expect(message).to.equal("");
            const error = querySelector(Q_CLASS_ERROR).textContent;
            expect(error).to.equal("Error: Not a backup file");
        }).slow(2000).timeout(3000)

        it("should reject a file that doest present as a zip", async () => {
            const buffer = Buffer.from("Mock backup");
            await post("/", "c:\\fake_path\\uploaded_backup.exe", buffer);

            const message = querySelector(Q_CLASS_MESSAGE).textContent;
            expect(message).to.equal("");
            const error = querySelector(Q_CLASS_ERROR).textContent;
            expect(error).to.equal("Error: Not a backup file");
        }).slow(2000).timeout(3000)

        it("should reject if no file is uploaded", async () => {
            await post("/", "c:\\fake_path\\uploaded_backup.exe", null);

            const message = querySelector(Q_CLASS_MESSAGE).textContent;
            expect(message).to.equal("");
            const error = querySelector(Q_CLASS_ERROR).textContent;
            expect(error).to.equal("Error: No file uploaded");
        }).slow(2000).timeout(3000)

        it("should reject get if has no permission", async () => {
            _smHasPermission.resolves(false);
            await expect(get("/")).to.eventually.be.rejectedWith(/404/);
        })

        it("should reject post if has no permission", async () => {
            _smHasPermission.resolves(false);
            const buffer = Buffer.from("Mock backup");
            await expect(post("/", "uploaded_backup.zip", buffer)).to.eventually.be.rejectedWith(/404/);
        })
    });

    describe("/create", () => {
        let _backupCreate: SinonStub = null;
        const _db: Database = {} as Database;

        beforeEach(() => {
            _backupCreate = stub(backup, "createBackup").resolves(`${TEST_DIR}/backups/test.zip`);
            stub(application, "database").value(_db);
        })

        it("should report a successful backup", async () => {
            await get("/create");

            expect(_backupCreate.callCount).to.equal(1);
            expect(_backupCreate.lastCall.args).to.eql([
                _db,
                TEST_DIR,
                `${TEST_DIR}/backups`
            ]);

            const button = querySelector<HTMLAnchorElement>(Q_CLASS_LINKBUTTON);
            expect(button.href).to.equal(PATH_BACKUP);
            const message = querySelector(Q_CLASS_MESSAGE).textContent;
            expect(message).to.equal("test.zip created.");
            const error = querySelector(Q_CLASS_ERROR).textContent;
            expect(error).to.equal("");
        }).slow(2000).timeout(3000)

        it("should report an error if backup failed", async () => {
            _backupCreate.rejects(new Error("Test Error"));
            await get("/create");

            const button = querySelector<HTMLAnchorElement>(Q_CLASS_LINKBUTTON);
            expect(button.href).to.equal(PATH_BACKUP);
            const message = querySelector(Q_CLASS_MESSAGE).textContent;
            expect(message).to.equal("");
            const error = querySelector(Q_CLASS_ERROR).textContent;
            expect(error).to.equal("Error: Test Error");
        }).slow(2000).timeout(3000)

        it("should reject if has no permission", async () => {
            _smHasPermission.resolves(false);
            await expect(get("/create")).to.eventually.be.rejectedWith(/404/);
        })
    })

    describe("/delete", () => {
        let _fsExists: SinonStub = null;
        let _fsUnlink: SinonStub = null;

        beforeEach(() => {
            _fsExists = stub(fs, "existsSync").returns(true);
            _fsUnlink = stub(fs.promises, "unlink").resolves();
        })

        it("should delete existing backup", async () => {
            await get("/delete/backup.zip");

            expect(_fsExists.callCount).to.eql(1);
            expect(_fsExists.lastCall.args).to.eql([`${TEST_DIR}/backups/backup.zip`]);
            expect(_fsUnlink.callCount).to.eql(1);
            expect(_fsUnlink.lastCall.args).to.eql([`${TEST_DIR}/backups/backup.zip`]);

            const button = querySelector<HTMLAnchorElement>(Q_CLASS_LINKBUTTON);
            expect(button.href).to.equal(PATH_BACKUP);
            const message = querySelector(Q_CLASS_MESSAGE).textContent;
            expect(message).to.equal("Backup deleted.");
            const error = querySelector(Q_CLASS_ERROR).textContent;
            expect(error).to.equal("");
        }).slow(2000).timeout(3000)

        it("should handle non-existent backup", async () => {
            _fsExists.returns(false);

            await get("/delete/backup.zip");

            expect(_fsExists.callCount).to.eql(1);
            expect(_fsExists.lastCall.args).to.eql([`${TEST_DIR}/backups/backup.zip`]);
            expect(_fsUnlink.callCount).to.eql(0);

            const button = querySelector<HTMLAnchorElement>(Q_CLASS_LINKBUTTON);
            expect(button.href).to.equal(PATH_BACKUP);
            const message = querySelector(Q_CLASS_MESSAGE).textContent;
            expect(message).to.equal("Backup deleted.");
            const error = querySelector(Q_CLASS_ERROR).textContent;
            expect(error).to.equal("");
        }).slow(2000).timeout(3000)

        it("should reject non-zip file", async () => {
             await get("/delete/spurious.txt");

            expect(_fsExists.callCount).to.eql(0);
            expect(_fsUnlink.callCount).to.eql(0);

            const button = querySelector<HTMLAnchorElement>(Q_CLASS_LINKBUTTON);
            expect(button.href).to.equal(PATH_BACKUP);
            const message = querySelector(Q_CLASS_MESSAGE).textContent;
            expect(message).to.equal("");
            const error = querySelector(Q_CLASS_ERROR).textContent;
            expect(error).to.equal("Error: Invalid backup");
        }).slow(2000).timeout(3000)

        it("should reject invalid backup name", async () => {
            await get("/delete/%2E%2E%2Fconfig.xml");

            expect(_fsExists.callCount).to.eql(0);
            expect(_fsUnlink.callCount).to.eql(0);

            const button = querySelector<HTMLAnchorElement>(Q_CLASS_LINKBUTTON);
            expect(button.href).to.equal(PATH_BACKUP);
            const message = querySelector(Q_CLASS_MESSAGE).textContent;
            expect(message).to.equal("");
            const error = querySelector(Q_CLASS_ERROR).textContent;
            expect(error).to.equal("Error: Invalid backup");
        }).slow(2000).timeout(3000)

        it("should reject if has no permission", async () => {
            _smHasPermission.resolves(false);
            await expect(get("/delete/backup.zip")).to.eventually.be.rejectedWith(/404/);
        }).slow(2000).timeout(3000)
    })

    describe("/restore", () => {
        let _fsCopy: SinonStub = null;

        beforeEach(() => {
            _getDataPath.withArgs("restore.zip").returns(`${TEST_DIR}/restore.zip`);
            _fsCopy = stub(fs.promises, "copyFile").resolves();
        })

        it("should copy backup to data directory", async () => {
            await get("/restore/backup.zip");

            expect(_fsCopy.callCount).to.eql(1);
            expect(_fsCopy.lastCall.args).to.eql([
                `${TEST_DIR}/backups/backup.zip`,
                `${TEST_DIR}/restore.zip`
            ]);

            const button = querySelector<HTMLAnchorElement>(Q_CLASS_LINKBUTTON);
            expect(button.href).to.equal(PATH_BACKUP);
            const message = querySelector(Q_CLASS_MESSAGE).textContent;
            expect(message).to.equal("Backup staged, please restart Itokawa to apply.");
            const error = querySelector(Q_CLASS_ERROR).textContent;
            expect(error).to.equal("");
        }).slow(2000).timeout(3000)

        it("should reject non-zip file", async () => {
            await get("/restore/spurious.txt");

            expect(_fsCopy.callCount).to.eql(0);

            const button = querySelector<HTMLAnchorElement>(Q_CLASS_LINKBUTTON);
            expect(button.href).to.equal(PATH_BACKUP);
            const message = querySelector(Q_CLASS_MESSAGE).textContent;
            expect(message).to.equal("");
            const error = querySelector(Q_CLASS_ERROR).textContent;
            expect(error).to.equal("Error: Invalid backup");
        }).slow(2000).timeout(3000)

        it("should reject invalid backup name", async () => {
            await get("/restore/%2E%2E%2Fconfig.xml");

            expect(_fsCopy.callCount).to.eql(0);

            const button = querySelector<HTMLAnchorElement>(Q_CLASS_LINKBUTTON);
            expect(button.href).to.equal(PATH_BACKUP);
            const message = querySelector(Q_CLASS_MESSAGE).textContent;
            expect(message).to.equal("");
            const error = querySelector(Q_CLASS_ERROR).textContent;
            expect(error).to.equal("Error: Invalid backup");
        }).slow(2000).timeout(3000)

        it("should reject if has no permission", async () => {
            _smHasPermission.resolves(false);
            await expect(get("/restore/backup.zip")).to.eventually.be.rejectedWith(/404/);
        }).slow(2000).timeout(3000)
    })

    describe("/download", () => {
        beforeEach(() => {
            fs.writeFileSync(`${TEST_DIR}/backup.zip`, "Mock backup");
            fs.writeFileSync(`${TEST_DIR}/not_backup.txt`, "Not a backup file");
        })

        it("should download the specified file", async () => {
            const data = await get("/download/backup.zip");
            expect(data).to.equal("Mock backup");
        }).slow(2000).timeout(3000)

        it("should return 404 for non-existent files", async () => {
            await expect(get("/download/foo.zip")).to.be.eventually.rejectedWith(/404/);
        }).slow(2000).timeout(3000)

        it("should return 404 for non-zip files", async () => {
            await expect(get("/download/not_backup.txt")).to.be.eventually.rejectedWith(/404/);
        }).slow(2000).timeout(3000)

        it("should reject if has no permission", async () => {
            _smHasPermission.resolves(false);
            await expect(get("/download/backup.zip")).to.eventually.be.rejectedWith(/404/);
        }).slow(2000).timeout(3000)
    })
})
