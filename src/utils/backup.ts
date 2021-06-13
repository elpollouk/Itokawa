import AdmZip = require("adm-zip");
import { Logger } from "./logger";
import * as fs from "fs";
const fsp = fs.promises;
import * as path from "path";
import { Database } from "../model/database";
import { timestampShort } from "../common/time";
//import * as dateFormat from "date"
let packageVersion = require('../../package.json').version;

const log = new Logger("Backup");

const DATA_FILE_PATTERNS = [
    /^config(\..+)?\.xml$/,
    /^data\.sqlite3$/
];

function shouldSkip(filename: string): boolean {
    for (const re of DATA_FILE_PATTERNS)
        if (filename.match(re))
            return false;

    return true;
}

async function ensureDir(path: string): Promise<void> {
    if (fs.existsSync(path)) return;
    await fsp.mkdir(path);
}

async function withTempDir(cb:(tempDir:string)=>Promise<void>) {
    const tempDir = await fsp.mkdtemp("Itokawa-");
    try {
        await cb(tempDir);
    }
    catch {
        await fsp.rmdir(tempDir, {
            recursive: true
        })
    }
}

function writeZip(zip: AdmZip, path: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        zip.writeZip(path, (err) => {
            if (err) reject(err);
            else resolve();
        })
    });
}

export async function createBackup(db: Database, dataDir: string, outputDir): Promise<string> {
    const now = timestampShort();
    const outputPath = `${outputDir}/Itokawa_${packageVersion}_${now}.zip`;

    await ensureDir(outputDir);
    await withTempDir(async (tempDir: string) => {
        const zip = new AdmZip();
        await writeZip(zip, outputPath);
    });

    return outputPath;
}

export async function restore(archivePath: string, targetDir: string) {
    log.info(`Restoring backup from ${archivePath} to ${targetDir}...`);

    let extractCount = 0;
    const zip = new AdmZip(archivePath);
    for (const entry of zip.getEntries()) {
        if (entry.isDirectory || shouldSkip(entry.name)) {
            log.verbose(`Skipping ${entry.entryName}`);
            continue;
        }

        log.info(`Extracting ${entry.name}...`);
        zip.extractEntryTo(entry, targetDir, false, true);
        extractCount++;
    }

    log.info(`Number of files restored: ${extractCount}`);
    if (extractCount === 0) throw new Error(`No valid files in ${archivePath}`);

    log.info("Backup restored")
}

export async function checkAndRestore(targetPath: string) {
    log.verbose(() => `Checking for restore.zip in ${targetPath}...`);
    const archive = path.join(targetPath, "restore.zip");
    const finalArchive = path.join(targetPath, ".restore.zip");
    if (!fs.existsSync(archive)) return;

    log.display(`Restoring ${archive}...`);
    await restore(archive, targetPath);

    if (fs.existsSync(finalArchive)) {
        log.info("Deleting old .restore.zip file...");
        fs.unlinkSync(finalArchive);
    }
    
    log.info("Renaming restore.zip to .restore.zip...");
    fs.renameSync(archive, finalArchive);

    log.info("Backup restored");
}
