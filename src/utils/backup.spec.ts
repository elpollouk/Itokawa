import { expect } from "chai";
import "mocha";
import * as fs from "fs";
import * as backup from "./backup";

const TEST_DIR = ".test.backup";

describe("Backup", () => {
    beforeEach(() => {
        if (fs.existsSync(TEST_DIR)) fs.rmdirSync(TEST_DIR, {recursive: true});
        fs.mkdirSync(TEST_DIR);
    })

    describe("restore", () => {
        it("should extract only the required files from a flat zip", async () => {
            await backup.restore("testdata/backup.zip", TEST_DIR);
            const entires = fs.readdirSync(TEST_DIR);

            expect(entires).to.eql([
                "config.xml",
                "data.sqlite3"
            ]);
        })

        it("should extract only the required files from a zip with directories", async () => {
            await backup.restore("testdata/backup_nested.zip", TEST_DIR);
            const entires = fs.readdirSync(TEST_DIR);

            expect(entires).to.eql([
                "config.xml",
                "data.sqlite3"
            ]);
        })

        it("should handle no database in the back up", async () => {
            await backup.restore("testdata/backup_no_db.zip", TEST_DIR);
            const entires = fs.readdirSync(TEST_DIR);

            expect(entires).to.eql([
                "config.xml"
            ]);
        })

        it("should handle no config file in the back up", async () => {
            await backup.restore("testdata/backup_no_config.zip", TEST_DIR);
            const entires = fs.readdirSync(TEST_DIR);

            expect(entires).to.eql([
                "data.sqlite3"
            ]);
        })

        it("reject a back up with no valid files", async () => {
            await expect(backup.restore("testdata/backup_nothing.zip", TEST_DIR)).to.be.eventually.rejectedWith("No valid files in testdata/backup_nothing.zip");
        })
    })
})
