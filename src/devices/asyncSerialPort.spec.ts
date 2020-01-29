import { expect, use } from "chai";
use(require("chai-as-promised"));

import "mocha";
import { spy, SinonSpy, stub, SinonStub, mock } from "sinon";
import { nextTick } from "../utils/promiseUtils";

import { AsyncSerialPort } from "./asyncSerialPort";
const SerialPort = require('@serialport/stream');
const MockBinding = require('@serialport/binding-mock');

const TEST_PORT = "/dev/ttyTest";

async function ticks(count: number): Promise<void> {
    while (count > 0) {
        await nextTick();
        count--;
    }
}

describe("AsyncSerialPort", () => {
    let openSpy: SinonSpy;
    let closeSpy: SinonSpy;
    let writeSpy: SinonSpy;
    let drainSpy: SinonSpy;

    beforeEach(() => {
        SerialPort.Binding = MockBinding;
        MockBinding.createPort(TEST_PORT);
        openSpy = spy(MockBinding.prototype, "open");
        closeSpy = spy(MockBinding.prototype, "close");
        writeSpy = spy(MockBinding.prototype, "write");
        drainSpy = spy(MockBinding.prototype, "drain");
    });

    afterEach(() => {
        openSpy.restore();
        closeSpy.restore();
        writeSpy.restore();
        drainSpy.restore();
    });

    function open(): Promise<AsyncSerialPort> {
        return AsyncSerialPort.open(TEST_PORT, { baudRate: 28800 });
    }

    function lastWrite(): Buffer {
        expect(drainSpy.callCount).to.equal(writeSpy.callCount);
        return writeSpy.lastCall.args[0];
    }

    function emitData(data: number[] | Buffer) {
        let binding = openSpy.lastCall.thisValue;
        binding.emitData(data);
    }

    describe("open", () => {
        it("should pass through correct options", async () => {
            let port = await open();

            expect(openSpy.getCall(0).args[0]).to.equal(TEST_PORT);
            expect(openSpy.getCall(0).args[1].baudRate).to.equal(28800);
            expect(openSpy.getCall(0).args[1].dataBits).to.equal(8);
            expect(openSpy.getCall(0).args[1].stopBits).to.equal(1);
            expect(openSpy.getCall(0).args[1].parity).to.equal("none");

            expect(port.bytesAvailable).to.equal(0);
        });

        it("should raise error for invalid port", async () => {
            let promise = AsyncSerialPort.open("COM_INVALID", {baudRate:115200});
            await expect(promise).to.be.rejected;
        });
    });

    describe("close", () => {
        it("should work", async () => {
            let port = await open();
            expect(closeSpy.callCount).to.equal(0);

            await port.close();

            expect(closeSpy.callCount).to.equal(1);
        });

        it("should reject promise on error", async () => {
            closeSpy.restore();
            let closeMock = stub(MockBinding.prototype, "close");
            closeMock.returns(Promise.reject(new Error("Close Error")));

            try {
                let port = await open();

                let promise = port.close();

                await expect(promise).to.eventually.be.rejectedWith("Close Error");
            }
            finally {
                closeMock.restore();
            }
        });
    });

    describe("write", () => {
        it("should correctly handle number array", async () => {
            let port = await open();
            
            await port.write([1, 2, 3]);

            expect(lastWrite()).to.eql(Buffer.from([1, 2, 3]));
        });

        it("should reject promise on write error", async () => {
            writeSpy.restore();
            let writeMock = stub(MockBinding.prototype, "write");
            writeMock.returns(Promise.reject(new Error("Write Error")));

            try {
                let port = await open();
                port.on("error", mock());

                let promise = port.write([0, 0]);

                await expect(promise).to.eventually.be.rejectedWith("Write Error");
            }
            finally {
                writeMock.restore();
            }
        });

        it("should reject promise on drain error", async () => {
            drainSpy.restore();
            let drainMock = stub(MockBinding.prototype, "drain");
            drainMock.returns(Promise.reject(new Error("Drain Error")));

            try {
                let port = await open();

                let promise = port.write([0, 0]);

                await expect(promise).to.eventually.be.rejectedWith("Drain Error");
            }
            finally {
                drainMock.restore();
            }
        });
    });

    describe("read", () => {
        it("should update bytes available on data arrival", async () => {
            let port = await open();
            emitData([3, 5, 7]);
            await ticks(2);

            expect(port.bytesAvailable).to.equal(3);
        });

        it("should drain buffer on complete read", async () => {
            let port = await open();
            emitData(Buffer.from([3, 2, 1, 0]));

            let data = await port.read(4);
            expect(data).to.eql([3, 2, 1, 0]);
            expect(port.bytesAvailable).to.equal(0);
        });

        it("should handle partial buffer read", async () => {
            let port = await open();
            emitData(Buffer.from([3, 2, 1, 0]));

            let data = await port.read(3);
            expect(data).to.eql([3, 2, 1]);
            expect(port.bytesAvailable).to.equal(1);

            data = await port.read(1);
            expect(data).to.eql([0]);
            expect(port.bytesAvailable).to.equal(0);
        });

        it("should not complete until all bytes available", async () => {
            let port = await open();
            emitData(Buffer.from([5, 7]));

            let data = null;
            port.read(3).then((d) => data = d);
            await ticks(3);
            expect(data).to.be.null;

            emitData([3]);
            await ticks(3);
            expect(data).to.eql([5, 7, 3]);
        });

        it("should reject overlapped read request", async () => {
            let port = await open();
            port.read(1);

            let promise = port.read(2);

            await expect(promise).to.eventually.be.rejected;
        });
    });

    describe("concatRead", () => {
        it("should concatenate read bytes onto existing array", async () => {
            let port = await open();
            emitData([3, 5, 7]);
            
            let data = await port.concatRead([11, 13], 3);

            expect(data).to.eql([11, 13, 3, 5, 7]);
        });

        it("should reject overlapped read request", async () => {
            let port = await open();
            port.read(1);

            let promise = port.concatRead([0], 2);

            await expect(promise).to.eventually.be.rejected;
        });
    });
});