import { expect } from "chai";
import "mocha";
import { stub, spy, SinonStub, restore } from "sinon";
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
import { isRegExp } from "util";
import { ICommandStation } from "./devices/commandStations/commandStation";

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
        db = { close: () => Promise.resolve() } as Database;
        db["prepare"] = stub().resolves({
            run: () => Promise.resolve(),
            release: () => Promise.resolve()
        });

        applyLogLevelStub = stub(commandLineArgs, "applyLogLevel");
        stub(os, "homedir").returns(TEST_HOME_DIR);
        backupCheckAndRestoreStub = stub(backup, "checkAndRestore").resolves();
        loadConfigStub = stub(config, "loadConfig").withArgs(path.join(TEST_ITOKAWA_DIR, "config.xml")).resolves(configXML);
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

    afterEach(async () => {
        await application.sessionManager.shutdown();
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
            expect(app.commandStation).to.be.null;
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

        it("should create a pid file if requested", async () => {
            const app = new Application();
            await app.start(args, true);

            const pidPath = dataPath("pid");
            expect(fs.existsSync(dataPath("pid"))).to.be.true;
            expect(fs.readFileSync(pidPath)).to.eql(Buffer.from("1234"));
        })

        it("should be safe to call if the data directory already exists", async () => {
            fs.mkdirSync(TEST_ITOKAWA_DIR);
            const mkdirSpy = spy(fs, "mkdirSync");
        
            const app = new Application();
            await app.start(args);

            expect(mkdirSpy.callCount).to.equal(0);
        })

        it("should reject if data directory path exists but is not a directory", async () => {
            fs.writeFileSync(TEST_ITOKAWA_DIR, "");

            const app = new Application();

            await expect(app.start(args)).to.be.eventually.rejectedWith(`${TEST_ITOKAWA_DIR} is not a directory`);
        })

        it("should pick up log level from config.xml if present", async () => {
            let level: LogLevel = LogLevel.NONE;
            configXML.set("application.log.level", "VERBOSE");
            loggerLogLevelStub.get(() => level);
            loggerLogLevelStub.set((l) => { 
                level = l
            });

            const app = new Application();
            await app.start(args);

            expect(level).to.eql(LogLevel.VERBOSE);
        })

        it("should not be possible to decrease below command line args log level setting via confix.xml", async () => {
            configXML.set("application.log.level", "ERROR");
            loggerLogLevelStub.set(() => { throw new Error("Log level setter should not be called") });

            const app = new Application();
            await app.start(args);
        })

        it("should ignore invalid log levels in config.xml", async () => {
            configXML.set("application.log.level", "INVALID");
            loggerLogLevelStub.set(() => { throw new Error("Log level setter should not be called") });

            const app = new Application();
            await app.start(args);
        })

        it("should set feature flags if present in config.xml", async () => {
            configXML.set("featureFlags.a", new config.ConfigNode());
            configXML.set("featureFlags.b", new config.ConfigNode());
            configXML.set("featureFlags.c", new config.ConfigNode());

            const app = new Application();
            await app.start(args);

            expect(app.featureFlags.isSet("a")).to.be.true;
            expect(app.featureFlags.isSet("b")).to.be.true;
            expect(app.featureFlags.isSet("c")).to.be.true;
        })

        it("should set feature flags from the command line args", async () => {
            args.features = "d,e,f";

            const app = new Application();
            await app.start(args);

            expect(app.featureFlags.isSet("d")).to.be.true;
            expect(app.featureFlags.isSet("e")).to.be.true;
            expect(app.featureFlags.isSet("f")).to.be.true;
        })

        it("should allow for an alternative data directory to be specified via the command line args", async () => {
            args.datadir = path.join(TEST_HOME_DIR, "altpath");
            loadConfigStub.withArgs(path.join(args.datadir, "config.xml")).resolves(configXML);
            const app = new Application();

            await app.start(args, true);

            expect(fs.existsSync(args.datadir)).to.be.true;
            expect(fs.existsSync(path.join(TEST_HOME_DIR, "altpath", "pid"))).to.be.true;
        })

        it("should allow for specifying a config profile via the command line args", async () => {
            const profileConfg = new config.ConfigNode();
            configXML.set("profile", "base");
            profileConfg.set("profile", "debug");
            stub(fs, "existsSync").withArgs(path.join(TEST_ITOKAWA_DIR, "config.debug.xml")).returns(true);
            loadConfigStub.withArgs(path.join(TEST_ITOKAWA_DIR, "config.debug.xml"), configXML).resolves(profileConfg);
            args.profile = "debug";
            const app = new Application();

            await app.start(args, true);

            expect(app.config).to.equal(profileConfg);
        })

        it("should continue if profile XML is missing", async () => {
            configXML.set("profile", "base");
            stub(fs, "existsSync").withArgs(path.join(TEST_ITOKAWA_DIR, "config.debug.xml")).returns(false);
            args.profile = "debug";
            const app = new Application();

            await app.start(args, true);

            expect(app.config).to.equal(configXML);
        })

        it("should reject an invalid config profile name", async () => {
            args.profile = "debug/config";
            const app = new Application();

            await expect(app.start(args, true)).to.be.eventually.rejectedWith("Invalid profile name 'debug/config'");
        })
    })

    describe("getDataPath", () => {
        it("should return the data directory if no sub file is specified", async () => {
            const app = new Application();
            await app.start(args);

            expect(app.getDataPath()).to.equal(TEST_ITOKAWA_DIR);
        })

        it("should return the path to the specified file in the data directory", async () => {
            const app = new Application();
            await app.start(args);

            expect(app.getDataPath("foo.txt")).to.equal(dataPath("foo.txt"));
        })
    })

    describe("saveConfig", () => {
        it("should attempt to save using the current config and data path", async () => {
            const saveConfigStub = stub(config, "saveConfig").resolves();

            const app = new Application();
            await app.start(args);
            await app.saveConfig();

            expect(saveConfigStub.lastCall.args).to.eql([dataPath("config.xml"), configXML]);
        })
    })

    describe("shutdown handler", () => {
        let commandStation: ICommandStation;
        let dbCloseStub: SinonStub;
        let csCloseStub: SinonStub;

        beforeEach(() => {
            commandStation = { close: () => Promise.resolve() } as ICommandStation;
            dbCloseStub = stub(db, "close").resolves();
            csCloseStub = stub(commandStation, "close").resolves();
        })

        it("should close the database", async () => {
            stub(process, "exit");
            const app = new Application();
            await app.start(args);

            await app.lifeCycle.shutdown();

            expect(dbCloseStub.callCount).to.equal(1);
        })

        it("should close the command station if one is connected", async () => {
            stub(process, "exit");
            const app = new Application();
            await app.start(args);
            app.commandStation = commandStation;

            await app.lifeCycle.shutdown();

            expect(dbCloseStub.callCount).to.equal(1);
            expect(csCloseStub.callCount).to.equal(1);
        })
    })
})
