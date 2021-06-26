import { expect } from "chai";
import "mocha";

let packagejson = require('../package.json');
let packagelockjson = require('../package-lock.json');

describe("Version", () => {
    it("should match in both package.json and package-lock.json", () => {
        // If these two values aren't kept in sync, it will break automatic updates by causing a merge conflict
        expect(packagelockjson.version).to.equal(packagejson.version);
        expect(packagelockjson.packages[""].version).to.equal(packagejson.version);
    })
})
