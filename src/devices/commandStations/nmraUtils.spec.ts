import { expect } from "chai";
import "mocha";
import "./nmraUtils";
import { encodeLongAddress, decodeLongAddress, ensureWithinRange, ensureCvNumber, ensureByte, ensureAddress } from "./nmraUtils";

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

    describe("decodeLongAddress", () => {
        it("should decode addresses below 100", () => {
            const address = decodeLongAddress([0, 99]);
            expect(address).to.equal(99);
        })

        it("should decode addresses below 100 with offset", () => {
            const address = decodeLongAddress([0, 0, 99], 1);
            expect(address).to.equal(99);
        })

        it("should decode addresses above 100", () => {
            const address = decodeLongAddress([0xC0, 159]);
            expect(address).to.equal(159);
        })

        it("should decode addresses below 100 with offset", () => {
            const address = decodeLongAddress([0, 0, 0xC0, 159], 2);
            expect(address).to.equal(159);
        })

        it("should decode address 9999", () => {
            const address = decodeLongAddress([0xE7, 0x0F]);
            expect(address).to.equal(9999);
        })

        it("should decode address 9999 with offset", () => {
            const address = decodeLongAddress([0xFF, 0xE7, 0x0F], 1);
            expect(address).to.equal(9999);
        })
    })

    describe("ensureWithinRange", () => {
        it("should accept value at lower bound", () => {
            ensureWithinRange(2, 2, 10, "Test Value");
        })

        it("should accept value at upper bound", () => {
            ensureWithinRange(10, 2, 10, "Test Value");
        })

        it("should accept value within range", () => {
            ensureWithinRange(6, 2, 10, "Test Value");
        })

        it("should reject value below lower bound", () => {
            expect(() => ensureWithinRange(1, 2, 10, "Test Value")).to.throw("Test Value outside of valid range");
        })

        it("should reject value below lower bound", () => {
            expect(() => ensureWithinRange(11, 2, 10, "Test Value")).to.throw("Test Value outside of valid range");
        })
    })

    describe("ensureAddress", () => {
        it("should accept value at lower bound", () => {
            ensureAddress(1);
        })

        it("should accept value at upper bound", () => {
            ensureAddress(9999);
        })

        it("should accept value within range", () => {
            ensureAddress(5000);
        })

        it("should reject value below lower bound", () => {
            expect(() => ensureAddress(0)).to.throw("Address 0 outside of valid range");
        })

        it("should reject value below lower bound", () => {
            expect(() => ensureAddress(10000)).to.throw("Address 10000 outside of valid range");
        })
    })

    describe("ensureCvNumber", () => {
        it("should accept value at lower bound", () => {
            ensureCvNumber(1);
        })

        it("should accept value at upper bound", () => {
            ensureCvNumber(255);
        })

        it("should accept value within range", () => {
            ensureCvNumber(128);
        })

        it("should reject value below lower bound", () => {
            expect(() => ensureCvNumber(0)).to.throw("CV 0 outside of valid range");
        })

        it("should reject value below lower bound", () => {
            expect(() => ensureCvNumber(256)).to.throw("CV 256 outside of valid range");
        })
    })

    describe("ensureByte", () => {
        it("should accept value at lower bound", () => {
            ensureByte(0);
        })

        it("should accept value at upper bound", () => {
            ensureByte(255);
        })

        it("should accept value within range", () => {
            ensureByte(128);
        })

        it("should reject value below lower bound", () => {
            expect(() => ensureByte(-1)).to.throw("Byte(-1) outside of valid range");
        })

        it("should reject value below lower bound", () => {
            expect(() => ensureByte(256)).to.throw("Byte(256) outside of valid range");
        })
    })
});