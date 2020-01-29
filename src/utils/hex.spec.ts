import { expect } from "chai";
import "mocha";

import * as hex from "./hex"

describe("Hexadecimal Utilities", () => {
    describe("toHumanHex", () => {
        it("should format number array", () => {
            let result = hex.toHumanHex([0, 10, 127, 255]);

            expect(result).to.equal("00, 0a, 7f, ff"); 
        });

        it("should format Buffer", () => {
            let result = hex.toHumanHex(Buffer.from([3, 17]));

            expect(result).to.equal("03, 11"); 
        });

        it("should format numbers above 255 for numer arrays, first number", () => {
            let result = hex.toHumanHex([512, 1]);

            expect(result).to.equal("200, 01")
        });

        it("should format numbers above 255 for numer arrays, second number", () => {
            let result = hex.toHumanHex([2, 257]);

            expect(result).to.equal("02, 101")
        });
    });
});