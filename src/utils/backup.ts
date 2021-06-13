import AdmZip = require("adm-zip");
import { Logger } from "./logger";
import * as fs from "fs";
import * as path from "path";
import { Database } from "../model/database";

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

export async function createBackup(db: Database, dataPath: string, outputPath: string): Promise<string> {
    throw new Error("Not Implemented");
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
