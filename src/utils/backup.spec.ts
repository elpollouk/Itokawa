import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import * as fs from "fs";
import * as crypto from "crypto";
import * as backup from "./backup";
import { Database } from "../model/database";
import * as AdmZip from "adm-zip";
let packageVersion = require('../../package.json').version;

const TEST_BACKUP_DIR = ".test.backup";
const TEST_OUTPUT_DIR = ".test.output";

const CONFIG_DEBUG_HASH = "7f27cd6865866f02a051e8eb418548c53df113d3";
const CONFIG_ELINK_HASH = "3457560f5c753e94814557fa4364fefcc20d9aeb";
const CONFIG_HASH = "9e81a9ca805ab7dc46845c6aef5d5a8d1a448da6";
const DATABASE_HASH = "2f12f4f6899f5eff776a97fde510c1618c5af4d9";

function rmDir(path: string) {
    if (fs.existsSync(path)) fs.rmdirSync(path, {recursive: true});
}

async function hashFile(filePath: string) {
    return new Promise<string>((resolve, reject) => {
        var fd = fs.createReadStream(filePath);
        var hash = crypto.createHash('sha1');

        fd.on('end', function() {
            fd.close();
            resolve(hash.digest('hex'));
        });
        fd.on('error', err => reject(err));

        fd.pipe(hash);
    });
}

function verifyZip(archivePath: string, expectedEntries: Set<string> | string[], notExpectedEntries?: Set<string> | string[]) {
    if (Array.isArray(expectedEntries)) expectedEntries = new Set(expectedEntries);
    notExpectedEntries = notExpectedEntries ?? new Set();
    if (Array.isArray(notExpectedEntries)) notExpectedEntries = new Set(notExpectedEntries);

    const found = new Set<string>();

    const zip = new AdmZip(archivePath);
    for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue;

        const name = entry.name;
        expect(notExpectedEntries).to.not.contain(name, "Unexpected zip entry found");
        expect(found).to.not.contain(name, "Duplicate zip entry found");
        if (expectedEntries.has(name)) found.add(name);
    }

    expect(found).to.eql(expectedEntries);
}

describe("Backup", () => {
    beforeEach(() => {
        rmDir(TEST_BACKUP_DIR);
        fs.mkdirSync(TEST_BACKUP_DIR);
    })

    describe("restore", () => {
        it("should extract only the required files from a flat zip", async () => {
            await backup.restore("testdata/backup.zip", TEST_BACKUP_DIR);
            const entires = fs.readdirSync(TEST_BACKUP_DIR);

            expect(entires).to.eql([
                "config.xml",
                "data.sqlite3"
            ]);
            expect(await hashFile(TEST_BACKUP_DIR + "/config.xml")).to.equal(CONFIG_HASH);
            expect(await hashFile(TEST_BACKUP_DIR + "/data.sqlite3")).to.equal(DATABASE_HASH);
        })

        it("should extract only the required files from a zip with directories", async () => {
            await backup.restore("testdata/backup_nested.zip", TEST_BACKUP_DIR);
            const entires = fs.readdirSync(TEST_BACKUP_DIR);

            expect(entires).to.eql([
                "config.xml",
                "data.sqlite3"
            ]);
            expect(await hashFile(TEST_BACKUP_DIR + "/config.xml")).to.equal(CONFIG_HASH);
            expect(await hashFile(TEST_BACKUP_DIR + "/data.sqlite3")).to.equal(DATABASE_HASH);
        })

        it("should extract profiles from zip", async () => {
            await backup.restore("testdata/backup_withprofiles.zip", TEST_BACKUP_DIR);
            const entires = fs.readdirSync(TEST_BACKUP_DIR);

            expect(entires).to.eql([
                "config.debug.xml",
                "config.elink.xml",
                "config.xml",
                "data.sqlite3"
            ]);
            expect(await hashFile(TEST_BACKUP_DIR + "/config.debug.xml")).to.equal(CONFIG_DEBUG_HASH);
            expect(await hashFile(TEST_BACKUP_DIR + "/config.elink.xml")).to.equal(CONFIG_ELINK_HASH);
            expect(await hashFile(TEST_BACKUP_DIR + "/config.xml")).to.equal(CONFIG_HASH);
            expect(await hashFile(TEST_BACKUP_DIR + "/data.sqlite3")).to.equal(DATABASE_HASH);
        })

        it("should handle no database in the back up", async () => {
            await backup.restore("testdata/backup_no_db.zip", TEST_BACKUP_DIR);
            const entires = fs.readdirSync(TEST_BACKUP_DIR);

            expect(entires).to.eql([
                "config.xml"
            ]);
            expect(await hashFile(TEST_BACKUP_DIR + "/config.xml")).to.equal(CONFIG_HASH);
        })

        it("should handle no config file in the back up", async () => {
            await backup.restore("testdata/backup_no_config.zip", TEST_BACKUP_DIR);
            const entires = fs.readdirSync(TEST_BACKUP_DIR);

            expect(entires).to.eql([
                "data.sqlite3"
            ]);
            expect(await hashFile(TEST_BACKUP_DIR + "/data.sqlite3")).to.equal(DATABASE_HASH);
        })

        it("should replace existing files", async () => {
            fs.writeFileSync(TEST_BACKUP_DIR + "/config.xml", "");
            fs.writeFileSync(TEST_BACKUP_DIR + "data.sqlite3", "");
            await backup.restore("testdata/backup.zip", TEST_BACKUP_DIR);

            expect(await hashFile(TEST_BACKUP_DIR + "/config.xml")).to.equal(CONFIG_HASH);
            expect(await hashFile(TEST_BACKUP_DIR + "/data.sqlite3")).to.equal(DATABASE_HASH);
        })

        it("reject a back up with no valid files", async () => {
            await expect(backup.restore("testdata/backup_nothing.zip", TEST_BACKUP_DIR)).to.be.eventually.rejectedWith("No valid files in testdata/backup_nothing.zip");
        })
    })

    describe("createBackup", () => {
        let _db: Database;
    
        beforeEach(() => {
            rmDir(TEST_OUTPUT_DIR);
            backup.restore("testdata/backup_withprofiles.zip", TEST_BACKUP_DIR);

            _db = {
                backup: (path: string) => {
                    fs.writeFileSync(path, "Mock database");
                    return Promise.resolve();
                }
            } as any;
        })

        it("should create a zip containing important files", async () => {
            const backupZipPath = await backup.createBackup(_db, TEST_BACKUP_DIR, TEST_OUTPUT_DIR);

            verifyZip(backupZipPath, [
                "config.debug.xml",
                "config.elink.xml",
                "config.xml",
                "data.sqlite3"
            ]);
        })

        it("should handle missing config", async () => {
            fs.unlinkSync(TEST_BACKUP_DIR + "/config.debug.xml");
            fs.unlinkSync(TEST_BACKUP_DIR + "/config.elink.xml");
            fs.unlinkSync(TEST_BACKUP_DIR + "/config.xml");

            const backupZipPath = await backup.createBackup(_db, TEST_BACKUP_DIR, TEST_OUTPUT_DIR);

            verifyZip(backupZipPath, [
                "data.sqlite3"
            ], [
                "config.debug.xml",
                "config.elink.xml",
                "config.xml"
            ]);
        })

        it("should ignore unrecognised files", async () => {
            fs.writeFileSync(TEST_BACKUP_DIR + "/spurious.txt", "Spurious file");

            const backupZipPath = await backup.createBackup(_db, TEST_BACKUP_DIR, TEST_OUTPUT_DIR);

            verifyZip(backupZipPath, [
                "config.debug.xml",
                "config.elink.xml",
                "config.xml",
                "data.sqlite3"
            ], [
                "spurious.txt"
            ]);
        })

        it("should have correctly formatted file name", async () => {
            const backupZipPath = await backup.createBackup(_db, TEST_BACKUP_DIR, TEST_OUTPUT_DIR);

            expect(backupZipPath).to.match(/^\.test\.output[\/\\]Itokawa_[0-9A-Za-z-\.]+_[\d]+\.zip$/);
            expect(fs.existsSync(backupZipPath)).to.be.true;
            const backupVersion = backupZipPath.match(/_([0-9A-Za-z-\.]+)_/)[1];
            expect(backupVersion).to.eql(packageVersion);
        })

        it("should reject if input directory is invalid", async () => {
            await expect(backup.createBackup(_db, "invalidDir", TEST_OUTPUT_DIR)).to.be.eventually.rejectedWith("Invalid source path");
        });

        it("should create output directory if needed", async () => {
            rmDir(TEST_OUTPUT_DIR);

            const backupZipPath = await backup.createBackup(_db, TEST_BACKUP_DIR, TEST_OUTPUT_DIR);

            expect(fs.existsSync(backupZipPath)).to.be.true;
        });
    })

    describe("checkAndRestore", () => {
        it("should not do anything if restore.zip isn't present", async () => {
            await backup.checkAndRestore(TEST_BACKUP_DIR);

            const files = fs.readdirSync(TEST_BACKUP_DIR);
            expect(files).to.be.empty;
        })

        it("should not do anything if the archive is not named restore.zip", async () => {
            fs.copyFileSync("testdata/backup.zip", TEST_BACKUP_DIR + "/.restore.zip");
            await backup.checkAndRestore(TEST_BACKUP_DIR);

            const files = fs.readdirSync(TEST_BACKUP_DIR);
            expect(files).to.eql([
                ".restore.zip"
            ]);
            expect(await hashFile(TEST_BACKUP_DIR + "/.restore.zip")).to.equal(await hashFile("testdata/backup.zip"));
        })

        it("should extract files are rename archive if restore.zip is present", async () => {
            fs.copyFileSync("testdata/backup.zip", TEST_BACKUP_DIR + "/restore.zip");
            await backup.checkAndRestore(TEST_BACKUP_DIR);

            const files = fs.readdirSync(TEST_BACKUP_DIR);
            expect(files).to.eql([
                ".restore.zip",
                "config.xml",
                "data.sqlite3"
            ]);
            expect(await hashFile(TEST_BACKUP_DIR + "/.restore.zip")).to.equal(await hashFile("testdata/backup.zip"));
        })

        it("should handle a previously restored archive in the target directory", async () => {
            fs.copyFileSync("testdata/backup_nested.zip", TEST_BACKUP_DIR + "/.restore.zip");
            fs.copyFileSync("testdata/backup.zip", TEST_BACKUP_DIR + "/restore.zip");
            await backup.checkAndRestore(TEST_BACKUP_DIR);

            const files = fs.readdirSync(TEST_BACKUP_DIR);
            expect(files).to.eql([
                ".restore.zip",
                "config.xml",
                "data.sqlite3"
            ]);
            expect(await hashFile(TEST_BACKUP_DIR + "/.restore.zip")).to.eql(await hashFile("testdata/backup.zip"));
        })
    })
})
