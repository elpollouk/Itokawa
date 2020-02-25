import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import { stub, SinonStub } from "sinon"
import { createSinonStubInstance, StubbedClass } from "../../utils/testUtils"
import { nextTick } from "../../utils/promiseUtils"
import { AsyncSerialPort } from "../asyncSerialPort"
import { ELinkCommandStation, ELinkCommandBatch } from "./elink";
import { CommandStationState } from "./commandStation";

const CONNECTION_STRING = "port=/dev/ttyACM0";

describe("eLink", () => {
    let serialPortOpenStub: SinonStub;
    let setTimeoutStub: SinonStub;
    let clearTimeoutStub: SinonStub;
    let serialPortStub: StubbedClass<AsyncSerialPort>;

    let portWrites: (number[] | Buffer)[];
    let portReads: number[][];

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

    beforeEach(() => {
        portWrites = [];
        initReads();

        serialPortStub = createSinonStubInstance(AsyncSerialPort);
        serialPortStub.read.callsFake((size) => {
            if (portReads.length === 0) return Promise.reject(new Error(`Unexpect port read in test, size=${size}`));
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
        })

        serialPortOpenStub = stub(AsyncSerialPort, "open")
            .returns(Promise.resolve(serialPortStub));

        setTimeoutStub = stub(global, "setTimeout").returns({} as NodeJS.Timeout);
        clearTimeoutStub = stub(global, "clearTimeout");
    })

    afterEach(() => {
        serialPortOpenStub.restore();
        setTimeoutStub.restore();
        clearTimeoutStub.restore();
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

        it ("should handshake correctly when required", async () => {
            portReads = [
                [0x01],
                [0x02, 0x03],
                [0x35, 0x00, 0x00, 0x00, 0x00, 0x00, 0x35],
                [0x01, 0x04, 0x05],
                [0x63, 0x21, 0x6B, 0x01, 0x28]
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
        });

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
    })

    describe("Command Batch", () => {
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

        it("should correctly encode loco addesses belowe 100", async () => {
            const commit = stub().returns(Promise.resolve());
            const batch = new ELinkCommandBatch(commit);

            batch.setLocomotiveSpeed(3, 127, true);
            await batch.commit();

            expect(commit.callCount).to.equal(1);
            expect(commit.lastCall.args).to.eqls([[
                [0xE4, 0x13, 0x00, 0x03, 0x7F, 0x8B]
            ]]);
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