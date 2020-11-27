import AdmZip = require("adm-zip");
import { Logger } from "./logger";

const log = new Logger("Backup");

const DATA_FILES = new Set([
    "config.xml",
    "data.sqlite3"
]);

export async function restore(archivePath: string, targetDir: string) {
    log.info(`Restoring backup from ${archivePath} to ${targetDir}...`);

    let extractCount = 0;
    const zip = new AdmZip(archivePath);
    for (const entry of zip.getEntries()) {
        if (entry.isDirectory || !DATA_FILES.has(entry.name)) {
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
