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
import { ServerFeatureFlags } from "./server/serverFeatureFlags";
import { TaskManager } from "./taskmanager/taskmanager";
import { RunInTask } from "./taskmanager/tasks/runin";
import { registerCommandStations } from "./devices/commandStations/commandStationDirectory";
import * as backup from "./utils/backup";
import { LifeCycle } from "./utils/lifeCycle";

const log = new Logger("Application");

const DATABASE_FILE = "data.sqlite3";

export function initDataDirectory(dataPath?: string) {
    dataPath = dataPath ?? pathMod.join(os.homedir(), ".itokawa");

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

export class Application {
    publicUrl = "";
    commandStation: ICommandStation = null;
    readonly taskmanager = new TaskManager();
    readonly featureFlags = new ServerFeatureFlags();
    readonly lifeCycle = new LifeCycle(() => this._shutdown());
    
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
        this._registerTasks();
    }

    // Initialise server life cycle handling
    //  * Initialise the data directory
    //  * Check for restore.zip and extract it if present
    //  * Load the config file
    //  * Load the feature flags
    //  * Configure logging
    //  * Fetch the current git revision
    //  * Write a pid file to the data directory
    //  * Open the local database
    //  * Start the command station mointoring process
    async start(args: CommanderStatic, savepid: boolean = false): Promise<void> {
        // We apply an initial log level based on the command line args so that we can debug
        // directory initialisation and config loading if needed
        applyLogLevel(args);

        this._dataPath = initDataDirectory(args.datadir);

        // Check if there are any backup files that need restoring before starting to load data
        await backup.checkAndRestore(this._dataPath);

        this._configPath = this.getDataPath("config.xml");
        this._config = await loadConfig(this._configPath);

        // Load up the feature flags from the config and the command line
        this.featureFlags.setFromConfig(this._config.getAs("featureFlags", new ConfigNode()));
        if (args.features) this.featureFlags.setFromCommandLine(args.features);
        for (const flag of this.featureFlags.getFlags())
            log.display(`Feature ${flag} enabled`);


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
        registerCommandStations();
        await DeviceEnumerator.monitorForDevice(args);
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
        await this.commandStation?.close();
    }

    private _registerTasks() {
        this.taskmanager.registerTaskFactory(RunInTask);
    }
}

export const application = new Application();
