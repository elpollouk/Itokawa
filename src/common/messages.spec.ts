import { expect } from "chai";
import { stub } from "sinon";
import "mocha";
import { generateMessageTag } from "./messages";

describe("Messages", () => {
    describe("generateMessageTag", () => {
        it("should generate a server tag if running under Node.js", () => {
            expect(generateMessageTag().startsWith("server:")).to.be.true;
        })

        it("should generate a client tag if running in a browser", () => {
            const processStub = stub(global, "process").value(global.undefined)
            try {
                expect(generateMessageTag().startsWith("client:")).to.be.true;
            }
            finally {
                processStub.restore();
            }
        })
    })
})