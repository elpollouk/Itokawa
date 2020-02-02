import * as fs from "fs";
import * as os from "os";
import * as pathMod from "path";
import { Logger } from "../utils/logger";

const log = new Logger("LifeCycle");
let _dataPath: string = null;

function initDataDirectory(dataPath: string) {
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

// Return the full path to an item in the data directory
export function getDataPath(path?: string) {
    if (!_dataPath) throw new Error("Data directory has not been initialised");

    if (path) return pathMod.join(_dataPath, path);
    return _dataPath;
}

// Initialise server life cycle handling
//  * Initialise the data directory
//  * Write a pid file to the data directory
export async function start(dataPath?: string) {
    return new Promise(async (resolve, reject) => {
        try {
            initDataDirectory(dataPath);

            const pid = process.pid;
            log.display(`pid=${pid}`);
            const pidPath = getDataPath("pid");
            fs.writeFileSync(pidPath, `${pid}`);
            
            resolve();
        }
        catch (ex) {
            reject(ex);
        }
    });
}