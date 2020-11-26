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

        // Two bugs going on here
        // adm-zip has a bug where it's not properly checking if the output file name is being set correctly (https://github.com/cthackers/adm-zip/issues/335)
        // @types/adm-zip doesn't have the output file name parameter
        zip.extractEntryTo.call(zip, entry, targetDir, false, true, entry.name);
        extractCount++;
    }

    log.info(`Number of files restored: ${extractCount}`);
    if (extractCount === 0) throw new Error(`No valid files in ${archivePath}`);

    log.info("Backup restored")
}
