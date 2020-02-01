import { expect } from "chai";
import "mocha";
import "./nmraUtils";
import { encodeLongAddress } from "./nmraUtils";

describe("NMRA Utilities", () => {
    describe("encodeLongAddress", () => {
        it("should correctly encode an address above 127 into number[]", () => {
            let buffer = [0, 0];
            encodeLongAddress(2732, buffer);

            expect(buffer).to.eql([0xCA, 0xAC]);
        });

        it("should correctly encode an address above 127 into Buffer", () => {
            let buffer = Buffer.alloc(2);
            encodeLongAddress(2732, buffer);

            expect(buffer).to.eql(Buffer.from([0xCA, 0xAC]));
        });

        it("should correctly encode an address above 127 into number[] with offset", () => {
            let buffer = [0, 0, 0, 0];
            encodeLongAddress(4305, buffer, 1);

            expect(buffer).to.eql([0x00, 0xD0, 0xD1, 0x00]);
        });

        it("should correctly encode an address above 100 into Buffer with offset", () => {
            let buffer = Buffer.alloc(4);
            encodeLongAddress(4305, buffer, 2);

            expect(buffer).to.eql(Buffer.from([0x00, 0x00, 0xD0, 0xD1]));
        });

        it("should correctly encode address 100", () => {
            let buffer = [0, 0];
            encodeLongAddress(100, buffer);

            expect(buffer).to.eql([0xC0, 0x64]);
        });

        it("should fail for address 99", () => {
            let buffer = Buffer.alloc(2);

            expect(() => encodeLongAddress(99, buffer)).to.throw("Invalid long address, address=99");
        });

        it("should fail for addresses below 99", () => {
            let buffer = Buffer.alloc(2);

            expect(() => encodeLongAddress(3, buffer)).to.throw("Invalid long address, address=3");
        });

        it("should correctly encode address 9999", () => {
            let buffer = [0, 0];
            encodeLongAddress(9999, buffer);

            expect(buffer).to.eql([0xE7, 0x0F]);
        });

        it("should fail for address 10000", () => {
            let buffer = Buffer.alloc(2);

            expect(() => encodeLongAddress(10000, buffer)).to.throw("Invalid long address, address=10000");
        });

        it("should fail for address well above 10000", () => {
            let buffer = Buffer.alloc(2);

            expect(() => encodeLongAddress(100000, buffer)).to.throw("Invalid long address, address=10000");
        });

        it("should fail if write is out of range for Buffer", () => {
            let buffer = Buffer.alloc(1);

            expect(() => encodeLongAddress(1234, buffer)).to.throw("Attempt to write outside of range of buffer, offset=0, buffer size=1");
        });

        it("should fail if write is out of range for number[]", () => {
            let buffer = [0, 0]

            expect(() => encodeLongAddress(1234, buffer, 4)).to.throw("Attempt to write outside of range of buffer, offset=4, buffer size=2");
        });

        it("should fail if offset is negative", () => {
            let buffer = Buffer.alloc(2);

            expect(() => encodeLongAddress(1234, buffer, -1)).to.throw("Attempt to write outside of range of buffer, offset=-1, buffer size=2");

        });
    });
});