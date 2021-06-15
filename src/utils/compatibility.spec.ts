import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import { restore, stub } from "sinon";
import * as fs from "fs";
import { rmdir } from "./compatibility";

describe("compatibility", () => {
    afterEach(() => {
        restore();
    })

    describe("rmdir", () => {
        it("should use rmdir if rm is not available", async () => {
            if (fs.promises.rm) stub(fs.promises, "rm").value(null);
            const rmdirStub = stub(fs.promises, "rmdir").resolves();

            await rmdir("foo");

            expect(rmdirStub.callCount).to.eql(1);
            expect(rmdirStub.lastCall.args).to.eql(["foo", {
                recursive: true
            }]);
        })

        it("should use rm if it is available", async () => {
            if (!fs.promises.rm) (fs.promises as any)["rm"] = () => { throw new Error("Not implemented"); }
            const rmStub = stub(fs.promises, "rm").resolves();
            const rmdirStub = stub(fs.promises, "rmdir").resolves();

            await rmdir("foo");

            expect(rmdirStub.callCount).to.eql(0);
            expect(rmStub.callCount).to.eql(1);
            expect(rmStub.lastCall.args).to.eql(["foo", {
                force: true,
                recursive: true
            }]);
        })
    });
})