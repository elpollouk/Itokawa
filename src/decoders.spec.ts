// Verify the decoders XML file can always be parsed
import { expect } from "chai";
import "mocha";
import * as fs from "fs";
import * as xml2js from "xml2js";

async function loadDecoders() {
    const xml = fs.readFileSync("static/data/decoders.xml", {
        encoding: "utf8"
    });

    const parser = new xml2js.Parser({ attrkey: "_attr" });
    const doc = await parser.parseStringPromise(xml);
    return doc["decoders"];
}

function verifyCvNames(cvNames: any[]) {
    expect(cvNames).to.not.be.undefined;
    for (const item of cvNames) {
        const cv = parseFloat(item["_attr"]["n"]);
        const text = item["_"];
        expect(cv).to.not.be.NaN;
        expect(text).to.not.be.undefined.and.not.equal("");
    }
}

describe("decoders.xml", () => {
    it("should have a version", async () => {
        const decoders = await loadDecoders();
        const version = decoders["_attr"]["version"]
        expect(version).to.match(/^\d+\.\d+$/);
    })

    it("should contain a valid loco CVs section", async () => {
        const decoders = await loadDecoders();
        const cvNames = decoders["locoCvNames"][0]["cv"];
        verifyCvNames(cvNames);
    })

    it("should contain a valid manufactures section", async () => {
        const decoders = await loadDecoders();
        const manufacturers = decoders["manufacturers"][0]["man"];
        expect(manufacturers).to.not.be.undefined;
        for (const item of manufacturers) {
            const id = parseFloat(item["_attr"]["n"]);
            const text = item["_"];
            expect(id).to.not.be.NaN;
            expect(text).to.not.be.undefined.and.not.equal("");
        }
    })

    it("should contain a valid loco decoders section", async () => {
        const decoders = await loadDecoders();
        const locoDecoders = decoders["locoDecoders"][0]["profile"];
        expect(locoDecoders).to.not.be.undefined;
        for (const item of locoDecoders) {
            const manufacturer = parseFloat(item["_attr"]["man"]);
            const version = parseFloat(item["_attr"]["ver"]);
            const name = item["_attr"]["name"];
            expect(manufacturer).to.not.be.NaN;
            expect(version).to.not.be.NaN;
            expect(name).to.not.be.undefined.and.not.equal("");

            const cvs = item["cvs"][0];
            expect(cvs).to.not.be.undefined.and.not.equal("");

            if ("locoCvNames" in item) {
                const cvNames = item["locoCvNames"][0]["cv"];
                verifyCvNames(cvNames);
            }
        }
    })
})