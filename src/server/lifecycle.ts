import * as fs from "fs";
import * as os from "os";
import * as pathMod from "path";
import { exec } from "child_process";
import { Logger } from "../utils/logger";

const log = new Logger("LifeCycle");
let _dataPath: string = null;
let _shutdownCommand = "sudo shutdown -h now";
let _gitRev: string = "";

function _initDataDirectory(dataPath: string) {
    dataPath = dataPath || pathMod.join(os.homedir(), ".itokawa");

    if (!fs.existsSync(dataPath)){
        fs.mkdirSync(dataPath);
    }
    else if (!fs.statSync(dataPath).isDirectory()) {
        throw new Error(`${dataPath} is not a directory`);
    }

    _dataPath = dataPath;
    log.display(`datadir=${_dataPath}`)
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

// Return the full path to an item in the data directory
export function getDataPath(path?: string) {
    if (!_dataPath) throw new Error("Data directory has not been initialised");

    if (path) return pathMod.join(_dataPath, path);
    return _dataPath;
}

// Returns the current git revision
export function getGitRevision() {
    return _gitRev;
}

// Initialise server life cycle handling
//  * Initialise the data directory
//  * Write a pid file to the data directory
//  * Fetch the current git revision
export async function start(dataPath?: string) {
    return new Promise(async (resolve, reject) => {
        try {
            _initDataDirectory(dataPath);

            const pid = process.pid;
            log.display(`pid=${pid}`);
            const pidPath = getDataPath("pid");
            fs.writeFileSync(pidPath, `${pid}`);

            _gitRev = await _getGitRevision();
            
            resolve();
        }
        catch (ex) {
            reject(ex);
        }
    });
}

export function shutdown() {
    log.info("Requesting shutdown...");
    return _execAsync(_shutdownCommand);
}
