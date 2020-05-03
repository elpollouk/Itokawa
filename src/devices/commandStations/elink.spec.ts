import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import { stub, SinonStub } from "sinon";
import { createSinonStubInstance, StubbedClass } from "../../utils/testUtils";
import {  nextTick } from "../../utils/promiseUtils";
import * as promiseUtils from "../../utils/promiseUtils";
import { AsyncSerialPort } from "../asyncSerialPort"
import { ELinkCommandStation, ELinkCommandBatch, applyChecksum } from "./elink";
import { CommandStationState, FunctionAction } from "./commandStation";

const CONNECTION_STRING = "port=/dev/ttyACM0";

describe("eLink", () => {
    let serialPortOpenStub: SinonStub;
    let setTimeoutStub: SinonStub;
    let promiseTimeoutStub: SinonStub;
    let clearTimeoutStub: SinonStub;
    let serialPortStub: StubbedClass<AsyncSerialPort>;

    let portWrites: (number[] | Buffer)[];
    let portReads: number[][];
    let onReadBufferEmpty: () => number[][];

    function initReads() {
        portReads = [];
        // Already initialised, no handshake required
        portReads.push([0x62]);
        portReads.push([0x22, 0x40, 0x00]);
        // Version Info
        portReads.push([0x63, 0x21, 0x6B, 0x01, 0x28]);
    }

    function clearIoForAck() {
        // Clear writes and store reads for command ack
        portWrites = [];
        portReads = [
            [0x62],
            [0x22, 0x40, 0x00]
        ];
    }

    async function initCommandStation(reads: number[][] = []) {
        // Gets through initial handshake then clears the write buffer and initialises
        // the read buffer for the test.
        const cs = await ELinkCommandStation.open(CONNECTION_STRING);
        portWrites = [];
        portReads = reads;
        return cs;
    }

    beforeEach(() => {
        portWrites = [];
        initReads();

        onReadBufferEmpty = () => null;

        serialPortStub = createSinonStubInstance(AsyncSerialPort);
        serialPortStub.read.callsFake((size) => {
            if (portReads.length === 0) {
                portReads = onReadBufferEmpty() || [];
                if (portReads.length === 0)
                    return Promise.reject(new Error(`Unexpect port read in test, size=${size}`));
            }
            const data = portReads.shift();
            if (data.length !== size) return Promise.reject(new Error(`Unexpected port read size in test, expected=${data.length}, actual=${size}`));
            return Promise.resolve(data);
        });
        serialPortStub.concatRead.callsFake(async (originalData, size) => {
            const data = await serialPortStub.read(size);
            return originalData.concat(data);
        });
        serialPortStub.write.callsFake((data) => {
            portWrites.push(data);
            return Promise.resolve();
        });
        stub(serialPortStub, "bytesAvailable").get(() => {
            return portReads.length;
        });

        serialPortOpenStub = stub(AsyncSerialPort, "open")
            .returns(Promise.resolve(serialPortStub));

        setTimeoutStub = stub(global, "setTimeout").returns({} as NodeJS.Timeout);
        clearTimeoutStub = stub(global, "clearTimeout");
        promiseTimeoutStub = stub(promiseUtils, "timeout").returns(Promise.resolve());
    })

    afterEach(() => {
        serialPortOpenStub.restore();
        setTimeoutStub.restore();
        clearTimeoutStub.restore();
        promiseTimeoutStub.restore();
    })

    describe("Open", () => {
        it("should open an sync serial port with the correct parameters and handshake", async () => {
            const cs = await ELinkCommandStation.open(CONNECTION_STRING);

            expect(cs.state).to.eql(CommandStationState.IDLE);
            expect(serialPortOpenStub.callCount).to.equal(1);
            expect(serialPortOpenStub.lastCall.args).to.eql([
                "/dev/ttyACM0",
                {
                    baudRate: 115200
                }
            ]);
            expect(serialPortStub.on.callCount).to.equal(1);
            expect(serialPortStub.close.callCount).to.equal(0);
            expect(setTimeoutStub.callCount).to.equal(1);
        })

        async function testHandshake(version: number) {
            portReads = [
                [0x01],
                [0x02, 0x03],
                [0x35, 0x00, 0x00, 0x00, 0x00, 0x00, 0x35],
                [0x01, 0x04, 0x05],
                applyChecksum([0x63, 0x21, version, 0x01, 0x00]) as number[]
            ];

            const cs = await ELinkCommandStation.open(CONNECTION_STRING);

            expect(cs.state).to.equal(CommandStationState.IDLE);
            expect(portReads).to.be.empty;
            expect(portWrites).to.eql([
                [0x21, 0x24, 0x05],
                [0x3A, 0x36, 0x34, 0x4A, 0x4B, 0x44, 0x38, 0x39, 0x42, 0x53, 0x54, 0x39],
                [0x35, 0x39, 0x39, 0x39, 0x39, 0x39, 0x0C],
                [0x21, 0x21, 0x00]
            ]);
        }

        it ("should handshake with firmware 1.05", () => testHandshake(0x69));
        it ("should handshake with firmware 1.07", () => testHandshake(0x6B));

        it("should fail if port isn't specified in connection string", async () => {
            await expect(ELinkCommandStation.open("")).to.be.eventually.rejectedWith("\"port\" not specified in connection string");
        })

        it("should fail if serial port fails to open", async () => {
            serialPortOpenStub.returns(Promise.reject(new Error("Mock Error")));
            await expect(ELinkCommandStation.open(CONNECTION_STRING)).to.be.eventually.rejectedWith("Mock Error");
        })

        it("should fail if unexpected eLink version (1.06)", async () => {
            // Remove 1.07 info message and replace it with a 1.06 message
            portReads.pop();
            portReads.push([0x63, 0x21, 0x6A, 0x01, 0x29]);
            await expect(ELinkCommandStation.open(CONNECTION_STRING)).to.be.eventually.rejectedWith("Unsupported eLink version encountered, version=106");
            expect(serialPortStub.close.callCount).to.equal(1);
            expect(serialPortStub.saveDebugSanpshot.callCount).to.equal(1);
        })

        it("should fail if unexpected message type received", async () => {
            // Remove 1.07 info message and replace it with a 1.06 message
            portReads = [
                [123]
            ];
            await expect(ELinkCommandStation.open(CONNECTION_STRING)).to.be.eventually.rejectedWith("Unrecognised message type, got 123");
            expect(serialPortStub.close.callCount).to.equal(1);
            expect(serialPortStub.saveDebugSanpshot.callCount).to.equal(1);
        })

        it("should raise an error if info message checksum is invalid", async () => {
            portReads = [
                [0x62],
                [0x22, 0x40, 0x01]
            ];

            await expect(ELinkCommandStation.open(CONNECTION_STRING)).to.be.eventually.rejectedWith("Invalid checksum for received message");
            expect(serialPortStub.close.callCount).to.equal(1);
            expect(serialPortStub.saveDebugSanpshot.callCount).to.equal(1);
        })

        it("should raise an error if unexpected handshake exchange message received", async () => {
            portReads = [
                [0x01],
                [0x02, 0x03],
                [0x36, 0x00, 0x00, 0x00, 0x00, 0x00, 0x36],
            ];

            await expect(ELinkCommandStation.open(CONNECTION_STRING)).to.be.eventually.rejectedWith("Unexpected message type, expected 53, but got 54");
            expect(serialPortStub.close.callCount).to.equal(1);
            expect(serialPortStub.saveDebugSanpshot.callCount).to.equal(1);
        })

        it("should raise an error if unexpected handshake complete message received", async () => {
            portReads = [
                [0x01],
                [0x02, 0x03],
                [0x35, 0x00, 0x00, 0x00, 0x00, 0x00, 0x35],
                [0x01, 0x02, 0x03],
            ];

            await expect(ELinkCommandStation.open(CONNECTION_STRING)).to.be.eventually.rejectedWith("Handshake failed");
            expect(serialPortStub.close.callCount).to.equal(1);
            expect(serialPortStub.saveDebugSanpshot.callCount).to.equal(1);
        })
    })

    describe("Close", () => {
        it("should close underlying port and goto correct state", async () => {
            const cs = await ELinkCommandStation.open(CONNECTION_STRING);
            await cs.close();

            expect(cs.state).to.equal(CommandStationState.UNINITIALISED);
            expect(serialPortStub.close.callCount).to.equal(1);
        })

        it("should be safe to call close multiple times", async () => {
            const cs = await ELinkCommandStation.open(CONNECTION_STRING);
            await cs.close();
            await cs.close();
            await cs.close();

            expect(cs.state).to.equal(CommandStationState.UNINITIALISED);
            expect(serialPortStub.close.callCount).to.equal(1);
        })
    })

    describe("Raw Writes", () => {
        it("should write raw data directly to the serial port", async () => {
            const cs = await ELinkCommandStation.open(CONNECTION_STRING);

            portWrites = [];
            await cs.writeRaw([0, 3, 5, 7]);

            expect(portWrites).to.eql([
                [0, 3, 5, 7]
            ]);
        })

        it("should wait on raw writes when not IDLE", async () => {
            const cs = await ELinkCommandStation.open(CONNECTION_STRING);
            cs["_state"] = CommandStationState.BUSY;
            
            const promise = cs.writeRaw([0, 3, 5, 7]);
            await nextTick();
            await nextTick();

            portWrites = [];
            cs["_setState"](CommandStationState.IDLE);
            await promise;

            expect(portWrites).to.eql([
                [0, 3, 5, 7]
            ]);
        })
    })

    describe("Events", () => {
        it("should correctly raise error events", async () => {
            const handler = stub();
            const cs = await ELinkCommandStation.open(CONNECTION_STRING);
            cs.on("error", handler);

            expect(serialPortStub.on.lastCall.args[0]).to.equal("error");
            serialPortStub.on.lastCall.args[1](new Error("Mock Error Event"));

            expect(handler.callCount).to.equal(1);
            expect(handler.lastCall.args[0].message).to.equal("Mock Error Event");
            expect(serialPortStub.saveDebugSanpshot.callCount).to.equal(1);

            // Verify that an errored port can be closed to release resources
            expect(serialPortStub.close.callCount).to.equal(0);
            cs.close();
            expect(serialPortStub.close.callCount).to.equal(1);
        })
    })

    describe("Heartbeat", () => {
        it("should send a heartbeat when timer expires", async () => {
            const cs = await ELinkCommandStation.open(CONNECTION_STRING);
            clearIoForAck();

            setTimeoutStub.lastCall.args[0]();
            expect(cs.state).to.equal(CommandStationState.BUSY);

            await nextTick();
            expect(cs.state).to.equal(CommandStationState.IDLE);
            expect(setTimeoutStub.callCount).to.equal(2);
            expect(portReads).to.be.empty;
            expect(portWrites).to.eql([
                [0x21, 0x24, 0x05]
            ]);
        })

        it("shouldn't send a heartbeat if eLink in busy state", async () => {
            const cs = await ELinkCommandStation.open(CONNECTION_STRING);
            cs["_state"] = CommandStationState.BUSY;

            setTimeoutStub.lastCall.args[0]();

            await nextTick();
            expect(setTimeoutStub.callCount).to.equal(1);
        })

        it("should fire error event on heartbeat error", async () => {
            const cs = await ELinkCommandStation.open(CONNECTION_STRING);
            const onError = stub();
            cs.on("error", onError);
            serialPortStub.write.throws(new Error("Mock Write Error"));

            setTimeoutStub.lastCall.args[0]();
            await nextTick();

            expect(onError.callCount).to.equal(1);
            expect(onError.lastCall.args[0].message).to.equal("Mock Write Error");
            expect(cs.state).to.equal(CommandStationState.ERROR);
            expect(serialPortStub.saveDebugSanpshot.callCount).to.equal(1);
        })

        it("should fire error event on unrecognised response to heartbeat", async () => {
            const cs = await ELinkCommandStation.open(CONNECTION_STRING);
            const onError = stub();
            cs.on("error", onError);
            portReads = [
                [97]
            ];

            setTimeoutStub.lastCall.args[0]();
            await nextTick();

            expect(onError.callCount).to.equal(1);
            expect(onError.lastCall.args[0].message).to.equal("Unrecognised message type, got 97");
            expect(cs.state).to.equal(CommandStationState.ERROR);
            expect(serialPortStub.saveDebugSanpshot.callCount).to.equal(1);
        })

        it("should fire error event if info response doesn't contrain expected first value", async () => {
            const cs = await ELinkCommandStation.open(CONNECTION_STRING);
            const onError = stub();
            cs.on("error", onError);
            portReads = [
                [0x62],
                [0x23, 0x40, 0x01]
            ];

            setTimeoutStub.lastCall.args[0]();
            await nextTick();

            expect(onError.callCount).to.equal(1);
            expect(onError.lastCall.args[0].message).to.equal("Unrecognised INFO_RESPONSE, got 62 23 40 01");
            expect(cs.state).to.equal(CommandStationState.ERROR);
            expect(serialPortStub.saveDebugSanpshot.callCount).to.equal(1);
        })

        it("should fire error event if info response doesn't contrain expected second value", async () => {
            const cs = await ELinkCommandStation.open(CONNECTION_STRING);
            const onError = stub();
            cs.on("error", onError);
            portReads = [
                [0x62],
                [0x22, 0x41, 0x01]
            ];

            setTimeoutStub.lastCall.args[0]();
            await nextTick();

            expect(onError.callCount).to.equal(1);
            expect(onError.lastCall.args[0].message).to.equal("Unrecognised INFO_RESPONSE, got 62 22 41 01");
            expect(cs.state).to.equal(CommandStationState.ERROR);
            expect(serialPortStub.saveDebugSanpshot.callCount).to.equal(1);
        })
    })

    describe("Batch Committing", () => {
        it("should write the correct data when committing a batch", async () => {
            const cs = await ELinkCommandStation.open(CONNECTION_STRING);
            const batch = await cs.beginCommandBatch();
            batch.setLocomotiveSpeed(1000, 127);
            batch.setLocomotiveSpeed(1001, 64, true);

            clearIoForAck();
            await batch.commit();

            expect(portReads).to.be.empty;
            expect(portWrites).to.eql([
                [0xE4, 0x13, 0xC3, 0xE8, 0xFF, 0x23],
                [0xE4, 0x13, 0xC3, 0xE9, 0x40, 0x9D],
                [0x21, 0x24, 0x05]
            ]);
            expect(clearTimeoutStub.callCount).to.equal(1);
            expect(setTimeoutStub.callCount).to.equal(2);
        })

        it("should be possible to commit two batches at the same time safely", async () => {
            const cs = await ELinkCommandStation.open(CONNECTION_STRING);
            const batch1 = await cs.beginCommandBatch();
            batch1.setLocomotiveSpeed(1000, 127);
            const batch2 = await cs.beginCommandBatch();
            batch2.setLocomotiveSpeed(1000, 127, true);

            portWrites = [];
            // Add ACK messages
            portReads.push([0x62]);
            portReads.push([0x22, 0x40, 0x00]);
            portReads.push([0x62]);
            portReads.push([0x22, 0x40, 0x00]);

            const p1 = batch1.commit();
            const p2 = batch2.commit();

            await p2;
            await p1;

            expect(portWrites).to.eql([
                [0xE4, 0x13, 0xC3, 0xE8, 0xFF, 0x23],
                [0x21, 0x24, 0x05],
                [0xE4, 0x13, 0xC3, 0xE8, 0x7F, 0xA3],
                [0x21, 0x24, 0x05]
            ]);
        })

        it("should track function latching within the same bank correctly", async () => {
            const cs = await ELinkCommandStation.open(CONNECTION_STRING);

            // Turn on F0
            clearIoForAck();
            let batch = await cs.beginCommandBatch();
            batch.setLocomotiveFunction(3, 0, FunctionAction.LATCH_ON);
            await batch.commit();

            expect(portReads).to.be.empty;
            expect(portWrites).to.eql([
                [0xE4, 0x20, 0x00, 0x03, 0x10, 215],
                [0x21, 0x24, 0x05]
            ]);

            // Turn on F1
            clearIoForAck();
            batch = await cs.beginCommandBatch();
            batch.setLocomotiveFunction(3, 1, FunctionAction.LATCH_ON);
            await batch.commit();

            expect(portReads).to.be.empty;
            expect(portWrites).to.eql([
                [0xE4, 0x20, 0x00, 0x03, 0x11, 214], // Both F0 and F1 are on
                [0x21, 0x24, 0x05]
            ]);

            // Turn off F1
            clearIoForAck();
            batch = await cs.beginCommandBatch();
            batch.setLocomotiveFunction(3, 1, FunctionAction.LATCH_OFF);
            await batch.commit();

            expect(portReads).to.be.empty;
            expect(portWrites).to.eql([
                [0xE4, 0x20, 0x00, 0x03, 0x10, 215],
                [0x21, 0x24, 0x05]
            ]);

            // Turn off F0
            clearIoForAck();
            batch = await cs.beginCommandBatch();
            batch.setLocomotiveFunction(3, 0, FunctionAction.LATCH_OFF);
            await batch.commit();

            expect(portReads).to.be.empty;
            expect(portWrites).to.eql([
                [0xE4, 0x20, 0x00, 0x03, 0x00, 199],
                [0x21, 0x24, 0x05]
            ]);
        })

        it("should track function banks independently", async () => {
            const cs = await ELinkCommandStation.open(CONNECTION_STRING);

            // Turn on F1
            clearIoForAck();
            let batch = await cs.beginCommandBatch();
            batch.setLocomotiveFunction(3, 1, FunctionAction.LATCH_ON);
            await batch.commit();

            // Turn on F28
            clearIoForAck();
            batch = await cs.beginCommandBatch();
            batch.setLocomotiveFunction(3, 28, FunctionAction.LATCH_ON);
            await batch.commit();

            expect(portReads).to.be.empty;
            expect(portWrites).to.eql([
                [0xE4, 0x28, 0x00, 0x03, 0x80, 79],
                [0x21, 0x24, 0x05]
            ]);
        })

        it("should generate latch-off message for triggered function", async () => {
            const cs = await ELinkCommandStation.open(CONNECTION_STRING);

            // Turn on F7
            clearIoForAck();
            let batch = await cs.beginCommandBatch();
            batch.setLocomotiveFunction(3, 7, FunctionAction.LATCH_ON);
            await batch.commit();

            // Trigger F5
            clearIoForAck();
            batch = await cs.beginCommandBatch();
            batch.setLocomotiveFunction(3, 5, FunctionAction.TRIGGER);
            await batch.commit();

            expect(portReads).to.be.empty;
            expect(portWrites).to.eql([
                [0xE4, 0x21, 0x00, 0x03, 0x05, 195],
                [0xE4, 0x21, 0x00, 0x03, 0x04, 194],
                [0x21, 0x24, 0x05]
            ]);

            expect(promiseTimeoutStub.callCount).to.equal(1);
            expect(promiseTimeoutStub.lastCall.args).to.eql([1]);
        })

        it("should not attempt to process non-loco control message for function latching", async () => {
            const cs = await ELinkCommandStation.open(CONNECTION_STRING);

            // Write a raw message that could be mistaken for a loco control message
            clearIoForAck();
            let batch = await cs.beginCommandBatch();
            batch.writeRaw([0xE0, 0x23, 0xC1, 0x34, 0x02, 0xD4]);
            await batch.commit();

            expect(portReads).to.be.empty;
            expect(portWrites).to.eql([
                [0xE0, 0x23, 0xC1, 0x34, 0x02, 0xD4],
                [0x21, 0x24, 0x05]
            ]);
        });
    })

    describe("readLocoCv", () => {
        it("should return the CV value", async () => {
            const cs = await initCommandStation([
                // CV selection confirmation
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60],
            ]);

            // Need to split the buffer as the eLink returns a variable number of ack messages so the device
            // implementation needs to wait until the buffer is drained before progressing
            onReadBufferEmpty = () => [
                // CV value
                [0x63],
                [0x14, 0x01, 0x03, 0x75],
                // Status info
                [0x62],
                [0x22, 0x40, 0x00]
            ];

            const value = await cs.readLocoCv(1);
            expect(value).to.equal(3);

            expect(portWrites).to.eql([
                // Select CV
                [0x22, 0x15, 0x01, 0x36],
                // Request Value
                [0x21, 0x10, 0x31],
                // Heartbeat
                [0x21, 0x24, 0x05] 
            ]);
            expect(portReads).to.be.empty;
        })

        it("should return the CV value if there are only 6 acks", async () => {
            const cs = await initCommandStation([
                // CV selection confirmation
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60],
            ]);

            // Need to split the buffer as the eLink returns a variable number of ack messages so the device
            // implementation needs to wait until the buffer is drained before progressing
            onReadBufferEmpty = () => [
                // CV value
                [0x63],
                [0x14, 0x02, 0x03, 0x76],
                // Status info
                [0x62],
                [0x22, 0x40, 0x00]
            ];

            const value = await cs.readLocoCv(2);
            expect(value).to.equal(3);

            expect(portWrites).to.eql([
                // Select CV
                [0x22, 0x15, 0x02, 0x35],
                // Request Value
                [0x21, 0x10, 0x31],
                // Heartbeat
                [0x21, 0x24, 0x05] 
            ]);
            expect(portReads).to.be.empty;
        })

        it("should return the CV value if there are unbalanced ack types", async () => {
            const cs = await initCommandStation([
                // CV selection confirmation
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60],
            ]);

            // Need to split the buffer as the eLink returns a variable number of ack messages so the device
            // implementation needs to wait until the buffer is drained before progressing
            onReadBufferEmpty = () => [
                // CV value
                [0x63],
                [0x14, 0x02, 0x13, 0x66],
                // Status info
                [0x62],
                [0x22, 0x40, 0x00]
            ];

            const value = await cs.readLocoCv(2);
            expect(value).to.equal(0x13);

            expect(portWrites).to.eql([
                // Select CV
                [0x22, 0x15, 0x02, 0x35],
                // Request Value
                [0x21, 0x10, 0x31],
                // Heartbeat
                [0x21, 0x24, 0x05] 
            ]);
            expect(portReads).to.be.empty;
        })

        it("should wait until IDLE before attempting to read CV", async () => {
            const cs = await initCommandStation([
                // CV selection confirmation
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60]
            ]);

            onReadBufferEmpty = () => [
                // CV value
                [0x63],
                [0x14, 0x08, 0x30, 0x4F],
                // Status info
                [0x62],
                [0x22, 0x40, 0x00]
            ];

            cs["_state"] = CommandStationState.BUSY;

            const then = stub();
            const promise = cs.readLocoCv(8).then(then);
            await nextTick();
            await nextTick();
            await nextTick();
            expect(then.callCount).to.equal(0);
            expect(portWrites).to.be.empty;
            
            cs["_setState"](CommandStationState.IDLE);
            await promise;
            expect(then.callCount).to.equal(1);
            expect(then.lastCall.args[0]).to.equal(48);
        })

        it("should return error if ERROR state entered while waiting for IDLE", async () => {
            const cs = await initCommandStation();
            cs["_state"] = CommandStationState.BUSY;

            const promise = cs.readLocoCv(8);
            await nextTick();
            await nextTick();
            await nextTick();
            cs["_setState"](CommandStationState.ERROR);

            await expect(promise).to.be.eventually.rejectedWith("Command station is in ERROR state");
        })

        it("should return an error if no loco is present", async () => {
            const cs = await initCommandStation([
                // CV selection confirmation
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60],
            ]);

            onReadBufferEmpty = () => [
                // CV value
                [0x61],
                [0x13, 0x72]
            ];

            await expect(cs.readLocoCv(1)).to.be.eventually.rejectedWith("Failed to read CV 1");
            expect(portReads).to.be.empty;
        })

        it("should return an error if unrecognaised message seen", async () => {
            const cs = await initCommandStation([
                // CV selection confirmation
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60]
            ]);

            onReadBufferEmpty = () => [
                // CV value
                [0xFF]
            ];

            await expect(cs.readLocoCv(1)).to.be.eventually.rejectedWith("Unexpected CV value response: ff");
        })

        it("should return an error if the wrong CV is read", async () => {
            const cs = await initCommandStation([
                // CV selection confirmation
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60]
            ]);

            onReadBufferEmpty = () => [
                // CV value
                [0x63],
                [0x14, 0x02, 0x03, 0x76],
            ];

            await expect(cs.readLocoCv(1)).to.be.eventually.rejectedWith("Received value for CV 2 but expected CV 1");
        })

        it("should return an error if CV selection response isn't as expected for first message type", async () => {
            const cs = await initCommandStation([
                // CV selection confirmation
                [0x61, 0x02, 0x63],
                [0x61, 0x13, 0x72]
            ]);

            await expect(cs.readLocoCv(1)).to.be.eventually.rejectedWith("Unexpected message: 61 13 72");
        })

        it("should return an error if CV selection response isn't as expected for second message type", async () => {
            const cs = await initCommandStation([
                // CV selection confirmation
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60],
                [0x61, 0x13, 0x72]
            ]);

            await expect(cs.readLocoCv(1)).to.be.eventually.rejectedWith("Unexpected message: 61 13 72");
        })

        it("should return an error if selection response checksum is invalid for first message type", async () => {
            const cs = await initCommandStation([
                // CV selection confirmation
                [0x61, 0x02, 0x64]
            ]);

            await expect(cs.readLocoCv(1)).to.be.eventually.rejectedWith("Invalid checksum for received message");
        })

        it("should return an error if selection response checksum is invalid for second message type", async () => {
            const cs = await initCommandStation([
                // CV selection confirmation
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x01, 0x60],
                [0x61, 0x02, 0x64]
            ]);

            await expect(cs.readLocoCv(1)).to.be.eventually.rejectedWith("Invalid checksum for received message");
        })

        it("should return an error if value response checksum is invalid", async () => {
            const cs = await initCommandStation([
                // CV selection confirmation
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60]
            ]);

            onReadBufferEmpty = () => [
                // CV value
                [0x63],
                [0x14, 0x01, 0x03, 0x70],
            ];

            await expect(cs.readLocoCv(1)).to.be.eventually.rejectedWith("Invalid checksum for received message");
        })

        it("should raise and error if invalid CV is requested", async () => {
            const cs = await initCommandStation();
            await expect(cs.readLocoCv(-1)).to.be.eventually.rejectedWith("CV -1 outside of valid range");
        })
    })

    describe("readWriteCv", () => {
        it("should write the CV value", async () => {
            const cs = await initCommandStation([
                // CV selection confirmation
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60]
            ]);

            onReadBufferEmpty = () => [
                // CV value
                [0x63],
                [0x14, 0x01, 0x10, 0x66],
                // Status info
                [0x62],
                [0x22, 0x40, 0x00]
            ];

            await cs.writeLocoCv(1, 16);

            expect(portWrites).to.eql([
                // Write CV
                [0x23, 0x16, 0x01, 0x10, 0x24],
                // Request Value
                [0x21, 0x10, 0x31],
                // Heartbeat
                [0x21, 0x24, 0x05] 
            ]);
            expect(portReads).to.be.empty;
        })

        it("should wait until IDLE to write the CV value", async () => {
            const cs = await initCommandStation([
                // CV selection confirmation
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60]
            ]);

            onReadBufferEmpty = () => [
                // CV value
                [0x63],
                [0x14, 0x01, 0x10, 0x66],
                // Status info
                [0x62],
                [0x22, 0x40, 0x00]
            ];

            cs["_state"] = CommandStationState.BUSY;

            const then = stub();
            const promise = cs.writeLocoCv(1, 16).then(then);
            await nextTick();
            await nextTick();
            await nextTick();
            expect(then.callCount).to.equal(0);
            expect(portWrites).to.be.empty;
            
            cs["_setState"](CommandStationState.IDLE);
            await promise;
            expect(then.callCount).to.equal(1);

            expect(portWrites).to.eql([
                // Write CV
                [0x23, 0x16, 0x01, 0x10, 0x24],
                // Request Value
                [0x21, 0x10, 0x31],
                // Heartbeat
                [0x21, 0x24, 0x05] 
            ]);
            expect(portReads).to.be.empty;
        })

        it("should return error if ERROR state entered while waiting for IDLE", async () => {
            const cs = await initCommandStation();
            cs["_state"] = CommandStationState.BUSY;

            const promise = cs.writeLocoCv(3, 5);
            await nextTick();
            await nextTick();
            await nextTick();
            cs["_setState"](CommandStationState.ERROR);

            await expect(promise).to.be.eventually.rejectedWith("Command station is in ERROR state");
        })

        it("should return an error if the wrong CV value is written", async () => {
            const cs = await initCommandStation([
                // CV selection confirmation
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x02, 0x63],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60],
                [0x61, 0x01, 0x60]
            ]);

            onReadBufferEmpty = () => [
                // CV value
                [0x63],
                [0x14, 0x01, 0x10, 0x66],
            ];

            await expect(cs.writeLocoCv(1, 4)).to.be.eventually.rejectedWith("Failed to write CV 1");
        })

        it("should raise and error if invalid CV is requested", async () => {
            const cs = await initCommandStation();
            await expect(cs.writeLocoCv(-1, 0)).to.be.eventually.rejectedWith("CV -1 outside of valid range");
        })

        it("should raise and error if invalid value is provided", async () => {
            const cs = await initCommandStation();
            await expect(cs.writeLocoCv(1, 256)).to.be.eventually.rejectedWith("Byte(256) outside of valid range");
        })
    })

    describe("Command Batch", () => {
        describe("setLocomotiveSpeed", () => {
            it("should correctly set loco speed forward", async () => {
                const commit = stub().returns(Promise.resolve());
                const batch = new ELinkCommandBatch(commit);

                batch.setLocomotiveSpeed(1234, 56);
                await batch.commit();

                expect(commit.callCount).to.equal(1);
                expect(commit.lastCall.args).to.eqls([[
                    [0xE4, 0x13, 0xC4, 0xD2, 0xB8, 0x59]
                ]]);
            })

            it("should correctly set loco speed reverse", async () => {
                const commit = stub().returns(Promise.resolve());
                const batch = new ELinkCommandBatch(commit);

                batch.setLocomotiveSpeed(1234, 56, true);
                await batch.commit();

                expect(commit.callCount).to.equal(1);
                expect(commit.lastCall.args).to.eqls([[
                    [0xE4, 0x13, 0xC4, 0xD2, 0x38, 0xD9]
                ]]);
            })

            it("should correctly encode loco addesses below 100", async () => {
                const commit = stub().returns(Promise.resolve());
                const batch = new ELinkCommandBatch(commit);

                batch.setLocomotiveSpeed(3, 127, true);
                await batch.commit();

                expect(commit.callCount).to.equal(1);
                expect(commit.lastCall.args).to.eqls([[
                    [0xE4, 0x13, 0x00, 0x03, 0x7F, 0x8B]
                ]]);
            })

            it("should reject loco addresses below 1", async () => {
                const commit = stub().returns(Promise.resolve());
                const batch = new ELinkCommandBatch(commit);

                expect(() => batch.setLocomotiveSpeed(0, 0)).to.throw("Invalid locomotive address, address=0");
            })

            it("should reject loco addresses above 9999", async () => {
                const commit = stub().returns(Promise.resolve());
                const batch = new ELinkCommandBatch(commit);

                expect(() => batch.setLocomotiveSpeed(10000, 0)).to.throw("Invalid long address, address=10000");
            })

            it("should reject speeds below 0", async () => {
                const commit = stub().returns(Promise.resolve());
                const batch = new ELinkCommandBatch(commit);

                expect(() => batch.setLocomotiveSpeed(9999, -1)).to.throw("Invalid speed requested, speed=-1");
            })

            it("should reject speeds above 127", async () => {
                const commit = stub().returns(Promise.resolve());
                const batch = new ELinkCommandBatch(commit);

                expect(() => batch.setLocomotiveSpeed(9999, 128)).to.throw("Invalid speed requested, speed=128");
            })
        })

        describe("setLocomotiveFunction", () => {
            it("should generate pseudo message for triggered function", async () => {
                const commit = stub().returns(Promise.resolve());
                const batch = new ELinkCommandBatch(commit);

                batch.setLocomotiveFunction(1234, 3, FunctionAction.TRIGGER);
                await batch.commit();

                expect(commit.callCount).to.equal(1);
                expect(commit.lastCall.args).to.eqls([[
                    [0xE4, 0x20, 0xC4, 0xD2, 0x04, FunctionAction.TRIGGER, 0xD6]
                ]]);
            })

            it("should generate pseudo message for latch-on function", async () => {
                const commit = stub().returns(Promise.resolve());
                const batch = new ELinkCommandBatch(commit);

                batch.setLocomotiveFunction(1234, 3, FunctionAction.LATCH_ON);
                await batch.commit();

                expect(commit.callCount).to.equal(1);
                expect(commit.lastCall.args).to.eqls([[
                    [0xE4, 0x20, 0xC4, 0xD2, 0x04, FunctionAction.LATCH_ON, 0xD7]
                ]]);
            })

            it("should generate pseudo message for latch-off function", async () => {
                const commit = stub().returns(Promise.resolve());
                const batch = new ELinkCommandBatch(commit);

                batch.setLocomotiveFunction(1234, 3, FunctionAction.LATCH_OFF);
                await batch.commit();

                expect(commit.callCount).to.equal(1);
                expect(commit.lastCall.args).to.eqls([[
                    [0xE4, 0x20, 0xC4, 0xD2, 0x04, FunctionAction.LATCH_OFF, 0xD4]
                ]]);
            })

            it("should map all functions to the correct eLink bank and bit flag", async () => {
                const commit = stub().returns(Promise.resolve());
                const batch = new ELinkCommandBatch(commit);

                for (let i = 0; i <  29; i++)
                    batch.setLocomotiveFunction(1234, i, FunctionAction.TRIGGER);
                await batch.commit();

                expect(commit.callCount).to.equal(1);
                expect(commit.lastCall.args).to.eqls([[
                    [0xE4, 0x20, 0xC4, 0xD2, 0x10, FunctionAction.TRIGGER, 194],
                    [0xE4, 0x20, 0xC4, 0xD2, 0x01, FunctionAction.TRIGGER, 211],
                    [0xE4, 0x20, 0xC4, 0xD2, 0x02, FunctionAction.TRIGGER, 208],
                    [0xE4, 0x20, 0xC4, 0xD2, 0x04, FunctionAction.TRIGGER, 214],
                    [0xE4, 0x20, 0xC4, 0xD2, 0x08, FunctionAction.TRIGGER, 218],
                    [0xE4, 0x21, 0xC4, 0xD2, 0x01, FunctionAction.TRIGGER, 210],
                    [0xE4, 0x21, 0xC4, 0xD2, 0x02, FunctionAction.TRIGGER, 209],
                    [0xE4, 0x21, 0xC4, 0xD2, 0x04, FunctionAction.TRIGGER, 215],
                    [0xE4, 0x21, 0xC4, 0xD2, 0x08, FunctionAction.TRIGGER, 219],
                    [0xE4, 0x22, 0xC4, 0xD2, 0x01, FunctionAction.TRIGGER, 209],
                    [0xE4, 0x22, 0xC4, 0xD2, 0x02, FunctionAction.TRIGGER, 210],
                    [0xE4, 0x22, 0xC4, 0xD2, 0x04, FunctionAction.TRIGGER, 212],
                    [0xE4, 0x22, 0xC4, 0xD2, 0x08, FunctionAction.TRIGGER, 216],
                    [0xE4, 0x23, 0xC4, 0xD2, 0x01, FunctionAction.TRIGGER, 208],
                    [0xE4, 0x23, 0xC4, 0xD2, 0x02, FunctionAction.TRIGGER, 211],
                    [0xE4, 0x23, 0xC4, 0xD2, 0x04, FunctionAction.TRIGGER, 213],
                    [0xE4, 0x23, 0xC4, 0xD2, 0x08, FunctionAction.TRIGGER, 217],
                    [0xE4, 0x23, 0xC4, 0xD2, 0x10, FunctionAction.TRIGGER, 193],
                    [0xE4, 0x23, 0xC4, 0xD2, 0x20, FunctionAction.TRIGGER, 241],
                    [0xE4, 0x23, 0xC4, 0xD2, 0x40, FunctionAction.TRIGGER, 145],
                    [0xE4, 0x23, 0xC4, 0xD2, 0x80, FunctionAction.TRIGGER, 81],
                    [0xE4, 0x28, 0xC4, 0xD2, 0x01, FunctionAction.TRIGGER, 219],
                    [0xE4, 0x28, 0xC4, 0xD2, 0x02, FunctionAction.TRIGGER, 216],
                    [0xE4, 0x28, 0xC4, 0xD2, 0x04, FunctionAction.TRIGGER, 222],
                    [0xE4, 0x28, 0xC4, 0xD2, 0x08, FunctionAction.TRIGGER, 210],
                    [0xE4, 0x28, 0xC4, 0xD2, 0x10, FunctionAction.TRIGGER, 202],
                    [0xE4, 0x28, 0xC4, 0xD2, 0x20, FunctionAction.TRIGGER, 250],
                    [0xE4, 0x28, 0xC4, 0xD2, 0x40, FunctionAction.TRIGGER, 154],
                    [0xE4, 0x28, 0xC4, 0xD2, 0x80, FunctionAction.TRIGGER, 90]
                ]]);
            })

            it("should reject loco addresses below 1", async () => {
                const commit = stub().returns(Promise.resolve());
                const batch = new ELinkCommandBatch(commit);

                expect(() => batch.setLocomotiveFunction(0, 0, FunctionAction.TRIGGER)).to.throw("Invalid locomotive address, address=0");
            })

            it("should reject loco addresses above 9999", async () => {
                const commit = stub().returns(Promise.resolve());
                const batch = new ELinkCommandBatch(commit);

                expect(() => batch.setLocomotiveFunction(10000, 0, FunctionAction.TRIGGER)).to.throw("Invalid long address, address=10000");
            })

            it("should reject functions below 0", async () => {
                const commit = stub().returns(Promise.resolve());
                const batch = new ELinkCommandBatch(commit);

                expect(() => batch.setLocomotiveFunction(3, -1, FunctionAction.TRIGGER)).to.throw("Invalid function requested, function=-1");
            })

            it("should reject functions above 28", async () => {
                const commit = stub().returns(Promise.resolve());
                const batch = new ELinkCommandBatch(commit);

                expect(() => batch.setLocomotiveFunction(3, 29, FunctionAction.TRIGGER)).to.throw("Invalid function requested, function=29");
            })
        })

        describe("writeRaw", () => {
            it("should correctly add a raw number[] command to the batch", async() => {
                const commit = stub().returns(Promise.resolve());
                const batch = new ELinkCommandBatch(commit);

                batch.writeRaw([9, 7, 6, 5]);
                await batch.commit();

                expect(commit.callCount).to.equal(1);
                expect(commit.lastCall.args).to.eqls([[
                    [0x09, 0x07, 0x06, 0x05]
                ]]);
            })

            it("should correctly add a raw buffer command to the batch", async() => {
                const commit = stub().returns(Promise.resolve());
                const batch = new ELinkCommandBatch(commit);

                batch.writeRaw(Buffer.from([9, 7, 8]));
                await batch.commit();

                expect(commit.callCount).to.equal(1);
                expect(commit.lastCall.args).to.eqls([[
                    [0x09, 0x07, 0x08]
                ]]);
            })

            it("should reject a null raw write", async() => {
                const commit = stub().returns(Promise.resolve());
                const batch = new ELinkCommandBatch(commit);

                expect(() => batch.writeRaw(null)).to.throw("Attempted to write null/undefined data");
            })

            it("should reject an empty raw write", async() => {
                const commit = stub().returns(Promise.resolve());
                const batch = new ELinkCommandBatch(commit);

                expect(() => batch.writeRaw([])).to.throw("Attempted to write empty data");
            })
        })

        describe("commit", () => {
            it("should correctly handle multiple commands", async () => {
                const commit = stub().returns(Promise.resolve());
                const batch = new ELinkCommandBatch(commit);

                batch.setLocomotiveSpeed(1234, 56, true);
                batch.writeRaw([3, 7, 11]);
                await batch.commit();

                expect(commit.callCount).to.equal(1);
                expect(commit.lastCall.args).to.eqls([[
                    [0xE4, 0x13, 0xC4, 0xD2, 0x38, 0xD9],
                    [0x03, 0x07, 0x0B]
                ]]);
            })

            it("should reject committing an empty batch ", async () => {
                const commit = stub().returns(Promise.resolve());
                const batch = new ELinkCommandBatch(commit);

                await expect(batch.commit()).to.be.eventually.rejectedWith("Attempted to commit empty batch");
            })

            it("should reject double committing batch", async () => {
                const commit = stub().returns(Promise.resolve());
                const batch = new ELinkCommandBatch(commit);
                batch.setLocomotiveSpeed(9999, 0);
                await batch.commit();

                await expect(batch.commit()).to.be.eventually.rejectedWith("Batch has already been committed");
            })

            it("should reject new command on already committed batch", async () => {
                const commit = stub().returns(Promise.resolve());
                const batch = new ELinkCommandBatch(commit);
                batch.setLocomotiveSpeed(9999, 0);
                await batch.commit();

                expect(() => batch.setLocomotiveSpeed(1000, 0)).to.throw("Batch has already been committed");
            })
        })
    })
})