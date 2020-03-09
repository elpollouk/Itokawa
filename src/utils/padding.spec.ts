import { expect } from "chai";
import "mocha";
import { padLeadingZero } from "./padding";

describe("Padding", () => {
    describe("padLeadingZero", () => {
        it("should pad to width 2", () => {
            expect(padLeadingZero(1, 2)).to.equal("01");
        })

        it("should pad to width 4", () => {
            expect(padLeadingZero(1, 4)).to.equal("0001");
        })

        it("should pad to width 8", () => {
            expect(padLeadingZero(1, 8)).to.equal("00000001");
        })

        it("should pad to width 8 multiple digits", () => {
            expect(padLeadingZero(1234, 8)).to.equal("00001234");
        })

        it("should raise error if width too high", () => {
            expect(() => padLeadingZero(1, 9)).to.throw("Unsupported pad width");
        })

        it("should raise error if width too low", () => {
            expect(() => padLeadingZero(1, 1)).to.throw("Unsupported pad width");
        })

        it("should raise error if width negative", () => {
            expect(() => padLeadingZero(1, -1)).to.throw("Unsupported pad width");
        })

        it("should not pad if over width", () => {
            expect(padLeadingZero(123, 2)).to.equal("123");
        })

        it("should pad negative values", () => {
            expect(padLeadingZero(-123, 8)).to.equal("-00000123");
        })
    })
})