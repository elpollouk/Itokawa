let packagejson = require('../package.json');
import * as fs from "fs";
import * as os from "os";
import * as pathMod from "path";
import { CommanderStatic } from "commander";
import { Logger, LogLevel } from "./utils/logger";
import { ConfigNode, loadConfig, saveConfig } from "./utils/config";
import { applyLogLevel } from "./utils/commandLineArgs";
import { execAsync } from "./utils/exec";
import { ICommandStation } from "./devices/commandStations/commandStation"
import { Database } from "./model/database";
import { DeviceEnumerator } from "./devices/deviceEnumerator";

const log = new Logger("Application");

const DATABASE_FILE = "data.sqlite3";
const DEVICE_RETRY_TIME = 5000;

function _initDataDirectory(dataPath: string) {
    dataPath = dataPath || pathMod.join(os.homedir(), ".itokawa");

    if (!fs.existsSync(dataPath)){
        fs.mkdirSync(dataPath);
    }
    else if (!fs.statSync(dataPath).isDirectory()) {
        throw new Error(`${dataPath} is not a directory`);
    }

    log.info(`datadir=${dataPath}`);
    return dataPath;
}

function _applyLogConfig(config: ConfigNode) {
    const logLevelName = config.getAs("level", "DISPLAY").toUpperCase();
    if (logLevelName in LogLevel) {
        const logLevel = LogLevel[logLevelName];
        // We only want to raise the log level via the config rather lower it
        // This is in case we've raised it via the the command line for debugging
        if (logLevel > Logger.logLevel) {
            Logger.logLevel = logLevel;
        }
    }
}

async function _getGitRevision() {
    log.info("Requesting git revision...");
    const rev = (await execAsync("git rev-parse HEAD")).trim();
    log.info(`Current git version: ${rev}`);
    return rev;
}

class Application {
    // The begin events fire before the DB is closed. This allows the application an opportunity to either abort
    // the shutdown/restart or perform cirtical tasks that require DB access.
    onshutdownbegin: ()=>Promise<void> = null;
    onrestartbegin: ()=>Promise<void> = null;
    onshutdown: ()=>Promise<void> = null;
    onrestart: ()=>Promise<void> = null;
    commandStation: ICommandStation = null;
    publicUrl: string = "";
    
    get config() {
        return this._config;
    }

    get packageVersion() {
        return packagejson.version;
    }

    get gitrev() {
        return this._gitrev;
    }

    get database() {
        return this._db;
    }

    private _args: CommanderStatic;
    private _config: ConfigNode = new ConfigNode();
    private _configPath: string;
    private _gitrev: string = "";
    private _dataPath: string;
    private _db: Database;

    constructor() {

    }

    // Initialise server life cycle handling
    //  * Initialise the data directory
    //  * Load the config file
    //  * Configure logging
    //  * Fetch the current git revision
    //  * Write a pid file to the data directory
    //  * Open the local database
    //  * Start the command station mointoring process
    async start(args: CommanderStatic, savepid: boolean = false): Promise<void> {
        this._args = args;

        // We apply an initial log level based on the command line args so that we can debug
        // directory initialisation and config loading if needed
        applyLogLevel(args);

        this._dataPath =_initDataDirectory(args.datadir);
        this._configPath = this.getDataPath("config.xml");
        this._config = await loadConfig(this._configPath);

        _applyLogConfig(this.config.getAs("application.log", new ConfigNode()));

        this._gitrev = await _getGitRevision();

        if (savepid) {
            const pid = process.pid;
            log.info(`pid=${pid}`);
            const pidPath = this.getDataPath("pid");
            fs.writeFileSync(pidPath, `${pid}`);
        }

        const dbPath = this.getDataPath(DATABASE_FILE);
        this._db = await Database.open(dbPath);

        // Technically, we don't need this await, but it improves the experience if a
        // device is already opened before starting the server
        await this._initDevice();
    }

    getDataPath(path?: string) {
        if (!this._dataPath) throw new Error("Data directory has not been initialised");
    
        if (path) return pathMod.join(this._dataPath, path);
        return this._dataPath;
    }

    async saveConfig() {
        await saveConfig(this._configPath, this.config);
    }

    private async _shutdown() {
        await this._db.close();
        if (this.commandStation) {
            this.commandStation.close();
        }
    }

    async shutdown() {
        if (this.onshutdownbegin) await this.onshutdownbegin();
        await this._shutdown();
        if (this.onshutdown) await this.onshutdown();
        process.exit(0);
    }

    async restart() {
        if (this.onrestartbegin) await this.onrestartbegin();
        await this._shutdown();
        if (this.onrestart) await this.onrestart();
        process.exit(0);
    }

    private async _initDevice() {
        // This will start monitoring for device errors and attempt recovery
        const errorHandler = (err: Error) => {
            if (this.commandStation) {
                // Remove the error handler to avoid memory leaks associated with it
                this.commandStation.off("error", errorHandler);
            }

            log.error("Command station error");
            log.error(err.stack);
            log.info(`Schedulling retry in ${DEVICE_RETRY_TIME}ms`);
            setTimeout(() => this._initDevice(), DEVICE_RETRY_TIME);
        };

        try {
            log.info("Attempting to open device...");
            this.commandStation = await this._openDevice();
            log.display(`Using ${this.commandStation.deviceId} ${this.commandStation.version}`);

            this.commandStation.on("error", errorHandler);
        }
        catch (err) {
            errorHandler(err);
        }
    }

    private async _openDevice(): Promise<ICommandStation> {
        if (this._args.device) {
            return await DeviceEnumerator.openDevice(this._args.device, this._args.connectionString);
        }
    
        let devices = await DeviceEnumerator.listDevices();
        if (devices.length === 0) throw Error("No command stations found");
    
        return await devices[0].open();
    }
}

export const application = new Application();