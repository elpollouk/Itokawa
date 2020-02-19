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

const log = new Logger("Application");

const DATABASE_FILE = "data.000.sqlite3";

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
    start(args: CommanderStatic, savepid: boolean = false): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
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

                resolve();
            }
            catch (ex) {
                reject(ex);
            }
        });
    }

    getDataPath(path?: string) {
        if (!this._dataPath) throw new Error("Data directory has not been initialised");
    
        if (path) return pathMod.join(this._dataPath, path);
        return this._dataPath;
    }

    async saveConfig() {
        await saveConfig(this._configPath, this.config);
    }

    async shutdown() {
        if (this.onshutdownbegin) await this.onshutdownbegin();
        await this._db.close();
        if (this.onshutdown) await this.onshutdown();
        process.exit(0);
    }

    async restart() {
        if (this.onrestartbegin) await this.onrestartbegin();
        await this._db.close();
        if (this.onrestart) await this.onrestart();
        process.exit(0);
    }
}

export const application = new Application();