import { expect } from "chai";
import "mocha";

import * as hex from "./hex"

describe("Hexadecimal Utilities", () => {
    describe("toHumanHex", () => {
        it("should format number array", () => {
            let result = hex.toHumanHex([0, 10, 127, 255]);

            expect(result).to.equal("00 0a 7f ff"); 
        })

        it("should format Buffer", () => {
            let result = hex.toHumanHex(Buffer.from([3, 17]));

            expect(result).to.equal("03 11"); 
        })

        it("should format numbers above 255 for numer arrays, first number", () => {
            let result = hex.toHumanHex([512, 1]);

            expect(result).to.equal("200 01")
        })

        it("should format numbers above 255 for numer arrays, second number", () => {
            let result = hex.toHumanHex([2, 257]);

            expect(result).to.equal("02 101")
        })

        it("should format an empty array", () => {
            let result = hex.toHumanHex([]);

            expect(result).to.equal("") 
        })
    })

    describe("fromHex", () => {
        it("should parse single byte", () => {
            const data = hex.fromHex("12");
            expect(data).to.eql([0x12]);
        })

        it("should parse multiple bytes", () => {
            const data = hex.fromHex("0123456789ABCDEF");
            expect(data).to.eql([0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF]);
        })

        it("should parse string with spaces", () => {
            const data = hex.fromHex(" fe dc ba 98 \n 76 54 32 10 ");
            expect(data).to.eql([0xFE, 0xDC, 0xBA, 0x98, 0x76, 0x54, 0x32, 0x10]);
        })

        it("should fail on non-hex characters", () => {
            expect(() => hex.fromHex("x")).to.throw("'x' is not a valid hex char");
            expect(() => hex.fromHex("g")).to.throw("'g' is not a valid hex char");
            expect(() => hex.fromHex("G")).to.throw("'G' is not a valid hex char");
            expect(() => hex.fromHex("@")).to.throw("'@' is not a valid hex char"); // ASCII char immediately before 'A'
            expect(() => hex.fromHex("`")).to.throw("'`' is not a valid hex char"); // ASCII char immediately before 'a'
        })

        it("should fail on incomplete byte", () => {
            expect(() => hex.fromHex("234")).to.throw("Incomplete hex string");
        })
    })

    describe("reandomHex", () => {
        it("should generate a valid string of the right length", () => {
            expect(hex.randomHex(2)).to.match(/^[0-9a-z]{2}$/);
            expect(hex.randomHex(3)).to.match(/^[0-9a-z]{3}$/);
            expect(hex.randomHex(7)).to.match(/^[0-9a-z]{7}$/);
        })

        it("should generate a unique value", () => {
            expect(hex.randomHex(8)).to.not.eql(hex.randomHex(8));
        })
    })
});
