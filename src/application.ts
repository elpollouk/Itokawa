let packagejson = require('../package.json');
import * as fs from "fs";
import * as os from "os";
import * as pathMod from "path";
import { CommanderStatic } from "commander";
import { exec } from "child_process";
import { Logger } from "./utils/logger";
import { ConfigNode, loadConfig } from "./utils/config";
import { applyLogLevel } from "./utils/commandLineArgs";

const log = new Logger("Application");

function _initDataDirectory(dataPath: string) {
    dataPath = dataPath || pathMod.join(os.homedir(), ".itokawa");

    if (!fs.existsSync(dataPath)){
        fs.mkdirSync(dataPath);
    }
    else if (!fs.statSync(dataPath).isDirectory()) {
        throw new Error(`${dataPath} is not a directory`);
    }

    log.display(`datadir=${dataPath}`);
    return dataPath;
}

function _execAsync(command: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
        try {
            log.info(`Executing: ${command}`);

            let rejected = false;
            const proc = exec(command, (err, stdout, stderr) => {
                if (err) reject(err);
                if (stderr) log.error(`stderr=${stderr}`);
                if (stdout) log.info(`stdout=${stdout}`);
                if (!rejected) resolve(stdout); 
            });
            proc.on("exit", (code) => {
                log.info(`Process exit code: ${code}`);
                if (code !== 0) {
                    rejected = true;
                    reject(new Error(`Process exited with code ${code}`));
                }
            });
        }
        catch (ex) {
            reject(ex);
        }
    });
}

async function _getGitRevision() {
    log.info("Requesting git revision...");
    const rev = (await _execAsync("git rev-parse HEAD")).trim();
    log.display(`Current git version: ${rev}`);
    return rev;
}

class Application {
    onshtudown: ()=>Promise<void> = null;
    get config() {
        return this._config;
    }

    get packageVersion() {
        return packagejson.version;
    }

    get gitrev() {
        return this._gitrev;
    }

    private _config: ConfigNode = new ConfigNode();
    private _gitrev: string = "";
    private _dataPath: string;

    constructor() {

    }

    // Initialise server life cycle handling
    //  * Initialise the data directory
    //  * Write a pid file to the data directory
    //  * Fetch the current git revision
    start(args: CommanderStatic, savepid: boolean = false): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                applyLogLevel(args);

                this._dataPath =_initDataDirectory(args.datadir);
                this._config = await loadConfig(this.getDataPath("config.xml"));
                this._gitrev = await _getGitRevision();

                if (savepid) {
                    const pid = process.pid;
                    log.display(`pid=${pid}`);
                    const pidPath = this.getDataPath("pid");
                    fs.writeFileSync(pidPath, `${pid}`);
                }

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

    async shutdown() {
        if (this.onshtudown) await this.onshtudown();
        process.exit(0);
    }
}

export const application = new Application();