import { expect } from "chai";
import "mocha";
import { stub, SinonStub, restore } from "sinon";
import { Application, application } from "./application";
let packagejson = require('../package.json');
import * as path from "path"
// Things to mock (in rough order of use)
import { CommanderStatic } from "commander";
import * as commandLineArgs from "./utils/commandLineArgs";
import * as fs from "fs";
import * as os from "os";
import * as backup from "./utils/backup";
import * as config from "./utils/config";
import { Logger, LogLevel } from "./utils/logger";
import * as exec from "./utils/exec";
import { Database } from "./model/database";
import * as commandStationDirectory from "./devices/commandStations/commandStationDirectory";
import { DeviceEnumerator } from "./devices/deviceEnumerator";

const TEST_HOME_DIR = ".test.home";
const TEST_ITOKAWA_DIR = path.join(TEST_HOME_DIR, ".itokawa");

function dataPath(file: string) {
    return path.join(TEST_ITOKAWA_DIR, file);
}

describe("Application", () => {
    let args: CommanderStatic;
    let configXML: config.ConfigNode;
    let db: Database;
    let applyLogLevelStub: SinonStub;
    let backupCheckAndRestoreStub: SinonStub;
    let loadConfigStub: SinonStub;
    let loggerLogLevelStub: SinonStub;
    let execAsyncStub: SinonStub;
    let databaseOpenStub: SinonStub;
    let registerCommandStationsStub: SinonStub;
    let monitorForDeviceStub: SinonStub;

    beforeEach(() => {
        args = {} as CommanderStatic;
        configXML = new config.ConfigNode();
        db = {} as Database;

        applyLogLevelStub = stub(commandLineArgs, "applyLogLevel");
        stub(os, "homedir").returns(TEST_HOME_DIR);
        backupCheckAndRestoreStub = stub(backup, "checkAndRestore").resolves();
        loadConfigStub = stub(config, "loadConfig").resolves(configXML);
        loggerLogLevelStub = stub(Logger, "logLevel").value(LogLevel.INFO);
        execAsyncStub = stub(exec, "execAsync").resolves("  GITREV  ");
        stub(process, "pid").value(1234);
        databaseOpenStub = stub(Database, "open").resolves(db);
        registerCommandStationsStub = stub(commandStationDirectory, "registerCommandStations");
        monitorForDeviceStub = stub(DeviceEnumerator, "monitorForDevice").resolves();

        if (fs.existsSync(TEST_HOME_DIR))
            fs.rmdirSync(TEST_HOME_DIR, { recursive: true });
        fs.mkdirSync(TEST_HOME_DIR);
    })

    afterEach(() => {
        restore();
    })

    describe("singleton", () => {
        it("should exist", () => {
            expect(application).to.be.instanceOf(Application);
        })
    })

    describe("start", () => {
        it("should initialise systems with default values", async () => {
            const app = new Application();
            await app.start(args);

            // Public properties
            expect(app.config).to.equal(configXML);
            expect(app.database).to.equal(db);
            expect(app.featureFlags.getFlags()).to.be.empty;
            expect(app.gitrev).to.equal("GITREV");
            expect(app.packageVersion).to.equal(packagejson.version);

            // External calls that got us there
            expect(applyLogLevelStub.lastCall.args).to.eql([args]);
            expect(backupCheckAndRestoreStub.lastCall.args).to.eql([TEST_ITOKAWA_DIR]);
            expect(loadConfigStub.lastCall.args).to.eql([dataPath("config.xml")]);
            expect(execAsyncStub.lastCall.args).to.eql(["git rev-parse HEAD"]);
            expect(databaseOpenStub.lastCall.args).to.eql([dataPath("data.sqlite3")]);
            expect(registerCommandStationsStub.callCount).to.equal(1);
            expect(monitorForDeviceStub.lastCall.args).to.eql([args]);

            // Local file system state
            expect(fs.existsSync(TEST_ITOKAWA_DIR)).to.be.true;
            expect(fs.existsSync(dataPath("pid"))).to.be.false;
        })
    })
})