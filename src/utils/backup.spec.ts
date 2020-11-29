import { expect } from "chai";
import "mocha";
import { stub, restore } from "sinon";
import * as fs from "fs";
import * as crypto from "crypto";
import * as backup from "./backup";

const TEST_DIR = ".test.backup";

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

describe("Backup", () => {
    beforeEach(() => {
        if (fs.existsSync(TEST_DIR)) fs.rmdirSync(TEST_DIR, {recursive: true});
        fs.mkdirSync(TEST_DIR);
    })

    afterEach(() => {
        restore();
    })

    describe("restore", () => {
        it("should extract only the required files from a flat zip", async () => {
            await backup.restore("testdata/backup.zip", TEST_DIR);
            const entires = fs.readdirSync(TEST_DIR);

            expect(entires).to.eql([
                "config.xml",
                "data.sqlite3"
            ]);
            expect(await hashFile(TEST_DIR + "/config.xml")).to.equal("9e81a9ca805ab7dc46845c6aef5d5a8d1a448da6");
            expect(await hashFile(TEST_DIR + "/data.sqlite3")).to.equal("2f12f4f6899f5eff776a97fde510c1618c5af4d9");
        })

        it("should extract only the required files from a zip with directories", async () => {
            await backup.restore("testdata/backup_nested.zip", TEST_DIR);
            const entires = fs.readdirSync(TEST_DIR);

            expect(entires).to.eql([
                "config.xml",
                "data.sqlite3"
            ]);
            expect(await hashFile(TEST_DIR + "/config.xml")).to.equal("9e81a9ca805ab7dc46845c6aef5d5a8d1a448da6");
            expect(await hashFile(TEST_DIR + "/data.sqlite3")).to.equal("2f12f4f6899f5eff776a97fde510c1618c5af4d9");
        })

        it("should handle no database in the back up", async () => {
            await backup.restore("testdata/backup_no_db.zip", TEST_DIR);
            const entires = fs.readdirSync(TEST_DIR);

            expect(entires).to.eql([
                "config.xml"
            ]);
            expect(await hashFile(TEST_DIR + "/config.xml")).to.equal("9e81a9ca805ab7dc46845c6aef5d5a8d1a448da6");
        })

        it("should handle no config file in the back up", async () => {
            await backup.restore("testdata/backup_no_config.zip", TEST_DIR);
            const entires = fs.readdirSync(TEST_DIR);

            expect(entires).to.eql([
                "data.sqlite3"
            ]);
            expect(await hashFile(TEST_DIR + "/data.sqlite3")).to.equal("2f12f4f6899f5eff776a97fde510c1618c5af4d9");
        })

        it("should replace existing files", async () => {
            fs.writeFileSync(TEST_DIR + "/config.xml", "");
            fs.writeFileSync(TEST_DIR + "data.sqlite3", "");
            await backup.restore("testdata/backup.zip", TEST_DIR);

            expect(await hashFile(TEST_DIR + "/config.xml")).to.equal("9e81a9ca805ab7dc46845c6aef5d5a8d1a448da6");
            expect(await hashFile(TEST_DIR + "/data.sqlite3")).to.equal("2f12f4f6899f5eff776a97fde510c1618c5af4d9");
        })

        it("reject a back up with no valid files", async () => {
            await expect(backup.restore("testdata/backup_nothing.zip", TEST_DIR)).to.be.eventually.rejectedWith("No valid files in testdata/backup_nothing.zip");
        })
    })

    describe("checkAndRestore", () => {
        it("should not do anything if restore.zip isn't present", async () => {
            await backup.checkAndRestore(TEST_DIR);

            const files = fs.readdirSync(TEST_DIR);
            expect(files).to.be.empty;
        })

        it("should not do anything if the archive is not named restore.zip", async () => {
            fs.copyFileSync("testdata/backup.zip", TEST_DIR + "/.restore.zip");
            await backup.checkAndRestore(TEST_DIR);

            const files = fs.readdirSync(TEST_DIR);
            expect(files).to.eql([
                ".restore.zip"
            ]);
            expect(await hashFile(TEST_DIR + "/.restore.zip")).to.equal(await hashFile("testdata/backup.zip"));
        })

        it("should extract files are rename archive if restore.zip is present", async () => {
            fs.copyFileSync("testdata/backup.zip", TEST_DIR + "/restore.zip");
            await backup.checkAndRestore(TEST_DIR);

            const files = fs.readdirSync(TEST_DIR);
            expect(files).to.eql([
                ".restore.zip",
                "config.xml",
                "data.sqlite3"
            ]);
            expect(await hashFile(TEST_DIR + "/.restore.zip")).to.equal(await hashFile("testdata/backup.zip"));
        })

        it("should handle a previously restored archive in the target directory", async () => {
            fs.copyFileSync("testdata/backup_nested.zip", TEST_DIR + "/.restore.zip");
            fs.copyFileSync("testdata/backup.zip", TEST_DIR + "/restore.zip");
            await backup.checkAndRestore(TEST_DIR);

            const files = fs.readdirSync(TEST_DIR);
            expect(files).to.eql([
                ".restore.zip",
                "config.xml",
                "data.sqlite3"
            ]);
            expect(await hashFile(TEST_DIR + "/.restore.zip")).to.eql(await hashFile("testdata/backup.zip"));
        })
    })
})
