import { expect, use } from "chai";
use(require("chai-as-promised"));

import "mocha";
import { spy, SinonSpy, stub, SinonStub, restore } from "sinon";
import { nextTick } from "../utils/promiseUtils";
import * as fs from "fs";
import * as time from "../common/time";
import { application } from "../application";

import { AsyncSerialPort } from "./asyncSerialPort";
import { ConfigNode } from "../utils/config";
import { Logger, LogLevel } from "../utils/logger";
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
        restore();
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

        it("should be safe to call multiple times", async () => {
            let port = await open();
            expect(closeSpy.callCount).to.equal(0);

            await port.close();
            await port.close();
            await port.close();

            expect(closeSpy.callCount).to.equal(1);
        })

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
                port.on("error", stub());

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
            await ticks(3);

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

        it("should return an empty array if the read times out", async () => {
            const setTimeoutStub = stub(global, "setTimeout");

            let port = await open();
            let promise = port.read(1, 0.5);

            expect(setTimeoutStub.callCount).to.equal(1);
            expect(setTimeoutStub.lastCall.args[0]).to.be.instanceOf(Function);
            expect(setTimeoutStub.lastCall.args[1]).to.equal(500);

            setTimeoutStub.lastCall.args[0]();
            expect(await promise).to.eql([]);
        })

        it("should reject if a port error is raised during a read", async () => {
            let port = await open();
            port.on("error", stub());
            let promise = port.read(1);

            port["_port"].emit("error", new Error("Test Error"));

            await expect(promise).to.be.eventually.rejectedWith("Test Error");
        })

        it("should reject if the port is closed during a read", async () => {
            let port = await open();
            port.on("error", stub());
            let promise = port.read(1);
            await port.close();

            await expect(promise).to.be.eventually.rejectedWith("Port closed");
        })
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

    describe("saveDebugSanpshot", () => {
        let applicationConfigStub: SinonStub;
        let applicationGetDataPathStub: SinonStub;
        let writeFileSyncStub: SinonStub;
        let timestampStub: SinonStub;
        let config: ConfigNode;

        beforeEach(() => {
            config = new ConfigNode();

            applicationConfigStub = stub(application, "config").value(config);
            applicationGetDataPathStub = stub(application, "getDataPath").returns("data/serialport.snapshot.txt");
            writeFileSyncStub = stub(fs, "writeFileSync");
            timestampStub = stub(time, "timestamp").callsFake(() => {
                return "timestamp";
            });

            // We'll explicitly enable it again via an updated config on a per-test basis
            AsyncSerialPort._disableDebugSnapshot();
        })

        afterEach(() => {
            applicationConfigStub.restore();
            applicationGetDataPathStub.restore();
            writeFileSyncStub.restore();
            timestampStub.restore();

            AsyncSerialPort._disableDebugSnapshot();
        })

        it("should do nothing if port debugging is not enabled", async () => {
            const port = await open();
            await port.write([1, 2, 3]);
            emitData([4, 5, 6]);
            await ticks(3);

            port.saveDebugSanpshot();
            expect(writeFileSyncStub.callCount).to.equal(0);
        })

        it("should write default of 10 entires if port debugging is enabled", async () => {
            config.set("debug.serialport", "");

            const port = await open();
            await port.write([0]);
            emitData([0]);
            await ticks(3);
            await port.write([0]);
            emitData([0]);
            await ticks(3);
            await port.write([1, 2, 3]);
            emitData([4, 5, 6]);
            await ticks(3);
            await port.write([7, 8, 9]);
            emitData([10, 11, 12]);
            await ticks(3);
            await port.write([13, 14, 15]);
            emitData([16, 17, 18]);
            await ticks(3);
            await port.write([19, 20, 21]);
            emitData([22, 23, 24]);
            await ticks(3);
            await port.write([25, 26, 27]);
            emitData([28, 29, 30]);
            await ticks(3);

            port.saveDebugSanpshot();
            expect(writeFileSyncStub.callCount).to.equal(1);
            expect(writeFileSyncStub.lastCall.args).to.eql(["data/serialport.snapshot.txt",
"timestamp: Sent: 01 02 03\n\
timestamp: Recv: 04 05 06\n\
timestamp: Sent: 07 08 09\n\
timestamp: Recv: 0a 0b 0c\n\
timestamp: Sent: 0d 0e 0f\n\
timestamp: Recv: 10 11 12\n\
timestamp: Sent: 13 14 15\n\
timestamp: Recv: 16 17 18\n\
timestamp: Sent: 19 1a 1b\n\
timestamp: Recv: 1c 1d 1e"]);
            expect(applicationGetDataPathStub.lastCall.args).to.eql(["serialport.snapshot.txt"]);
        })

        it("should write the configured number of entires if port debugging is enabled", async () => {
            config.set("debug.serialport.snapshotsize", 4);

            const port = await open();
            await port.write([0]);
            emitData([0]);
            await ticks(3);
            await port.write([0]);
            emitData([0]);
            await ticks(3);
            await port.write([1, 2, 3]);
            emitData([4, 5, 6]);
            await ticks(3);
            await port.write([7, 8, 9]);
            emitData([10, 11, 12]);
            await ticks(3);
            await port.write([13, 14, 15]);
            emitData([16, 17, 18]);
            await ticks(3);
            await port.write([19, 20, 21]);
            emitData([22, 23, 24]);
            await ticks(3);
            await port.write([25, 26, 27]);
            emitData([28, 29, 30]);
            await ticks(3);

            port.saveDebugSanpshot();
            expect(writeFileSyncStub.callCount).to.equal(1);
            expect(writeFileSyncStub.lastCall.args).to.eql(["data/serialport.snapshot.txt",
"timestamp: Sent: 13 14 15\n\
timestamp: Recv: 16 17 18\n\
timestamp: Sent: 19 1a 1b\n\
timestamp: Recv: 1c 1d 1e"]);
            expect(applicationGetDataPathStub.lastCall.args).to.eql(["serialport.snapshot.txt"]);
        })

        it("should preserve events across port close and reopen", async () => {
            config.set("debug.serialport.snapshotsize", 6);

            let port = await open();
            await port.write([13, 14, 15]);
            emitData([16, 17, 18]);
            await ticks(3);
            await port.write([19, 20, 21]);
            emitData([22, 23, 24]);
            await ticks(3);
            await port.write([25, 26, 27]);
            emitData([28, 29, 30]);
            await ticks(3);

            await port.close()
            port = await open()

            await port.write([31, 32, 33]);
            emitData([34, 35, 36]);
            await ticks(3);

            port.saveDebugSanpshot();
            expect(writeFileSyncStub.callCount).to.equal(1);
            expect(writeFileSyncStub.lastCall.args).to.eql(["data/serialport.snapshot.txt",
"timestamp: Sent: 19 1a 1b\n\
timestamp: Recv: 1c 1d 1e\n\
timestamp: Close: /dev/ttyTest\n\
timestamp: Open: /dev/ttyTest\n\
timestamp: Sent: 1f 20 21\n\
timestamp: Recv: 22 23 24"]);
            expect(applicationGetDataPathStub.lastCall.args).to.eql(["serialport.snapshot.txt"]);
        })
    })
});