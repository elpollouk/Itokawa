import AdmZip = require("adm-zip");
import { Logger } from "./logger";

const log = new Logger("Backup");

const DATA_FILES = new Set([
    "config.xml",
    "data.sqlite3"
]);

export async function restore(archivePath: string, targetDir: string) {
    log.info(`Restoring backup from ${archivePath} to ${targetDir}...`);

    const zip = new AdmZip(archivePath);
    for (const entry of zip.getEntries()) {
        if (entry.isDirectory || !DATA_FILES.has(entry.name)) {
            log.verbose(`Skipping ${entry.entryName}`);
            continue;
        }

        log.info(`Extracting ${entry.name}...`);

        // Two bugs going on here
        // adm-zip has a bug where it's not properly checking if the output file name is being set correctly
        // @types/adm-zip doesn't have the output file name parameter
        zip.extractEntryTo.call(zip, entry, targetDir, false, true, entry.name);
    }

    log.info("Backup restored")
}
