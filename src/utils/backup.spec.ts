import { expect } from "chai";
import "mocha";
import * as fs from "fs";
import * as backup from "./backup";

const TEST_DIR = ".test.backup";
const TEST_ARCHIVE = "testdata/backup.zip";

describe("Backup", () => {
    beforeEach(() => {
        if (fs.existsSync(TEST_DIR)) fs.rmdirSync(TEST_DIR, {recursive: true});
        fs.mkdirSync(TEST_DIR);
    })

    describe("restore", () => {
        it("should extract only the required files", async () => {
            await backup.restore(TEST_ARCHIVE, TEST_DIR);
            const entires = fs.readdirSync(TEST_DIR);

            expect(entires).to.eql([
                "config.xml",
                "data.sqlite3"
            ]);
        })
    })
})
