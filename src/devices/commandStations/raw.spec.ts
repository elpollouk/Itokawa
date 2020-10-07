import { expect, use } from "chai";
use(require("chai-as-promised"));
import "mocha";
import { stub, SinonStub } from "sinon"
import { createSinonStubInstance, StubbedClass } from "../../utils/testUtils"
import { AsyncSerialPort } from "../asyncSerialPort"
import { RawCommandStation } from "./raw"
import { CommandStationState } from "./commandStation";

enum EventIndex {
    ERROR = 0,
    DATA = 1
}

const CONNECTION_STRING = "port=COM2";

describe("Raw Command Station", () => {
    let serialPortOpenStub: SinonStub;
    let serialPortStub: StubbedClass<AsyncSerialPort>;

    beforeEach(() => {
        serialPortStub = createSinonStubInstance(AsyncSerialPort);
        serialPortStub.write.callsFake((data) => {
            return Promise.resolve();
        })

        serialPortOpenStub = stub(AsyncSerialPort, "open")
            .returns(Promise.resolve(serialPortStub));

    })

    afterEach(() => {
        serialPortOpenStub.restore();
    })

    describe("Open", () => {
        it("should open the serial port with default paramters", async () => {
            const cs = await RawCommandStation.open(CONNECTION_STRING);
            expect(cs.state).to.equal(CommandStationState.IDLE);
            expect(serialPortOpenStub.callCount).to.equal(1);
            expect(serialPortOpenStub.lastCall.args).to.eql([
                "COM2", {
                    baudRate: 115200,
                    dataBits: 8,
                    stopBits: 1,
                    parity: "none"
                }
            ]);
            expect(serialPortStub.on.callCount).to.equal(2);
            expect(serialPortStub.on.getCall(EventIndex.ERROR).args[0]).to.equal("error");
            expect(serialPortStub.on.getCall(EventIndex.DATA).args[0]).to.equal("data");
        })

        it("should open serial port with configured parameters", async () => {
            await RawCommandStation.open("port=COM2;baud=9600;dataBits=7;stopBits=2;parity=even");
            expect(serialPortOpenStub.callCount).to.equal(1);
            expect(serialPortOpenStub.lastCall.args).to.eql([
                "COM2", {
                    baudRate: 9600,
                    dataBits: 7,
                    stopBits: 2,
                    parity: "even"
                }
            ]);
        })

        it("should fail if no port specified", async () => {
            await expect(RawCommandStation.open("")).to.be.eventually.rejectedWith("\"port\" not specified in connection string");
        })
    })

    describe("Close", () => {
        it("should close the serial port", async () => {
            const cs = await RawCommandStation.open(CONNECTION_STRING);
            await cs.close();
            expect(cs.state).to.equal(CommandStationState.UNINITIALISED);
            expect(serialPortStub.close.callCount).to.equal(1);
        })
    })

    describe("Raw Write", () => {
        it("should pass the data to the serial port", async () => {
            const cs = await RawCommandStation.open(CONNECTION_STRING);
            const promise = cs.writeRaw([3, 5, 7]);
            expect(serialPortStub.write.lastCall.args[0]).to.eql([3, 5, 7]);
            expect(cs.state).to.equal(CommandStationState.BUSY);
            await promise;
            expect(cs.state).to.equal(CommandStationState.IDLE);
        })
    })

    describe("Begin Batch", () => {
        it("should not be implemented", async () => {
            const cs = await RawCommandStation.open(CONNECTION_STRING);
            await expect(cs.beginCommandBatch()).to.be.eventually.rejectedWith("Method not implemented.");
        })
    })

    describe("Events", () => {
        it("should forward port error events", async () => {
            const handler = stub();
            const cs = await RawCommandStation.open(CONNECTION_STRING);
            cs.on("error", handler);
            serialPortStub.on.getCall(EventIndex.ERROR).args[1](new Error("Mock Error"));
            expect(handler.callCount).to.equal(1);
            expect(handler.lastCall.args[0].message).to.equal("Mock Error");
        })

        it("should forward port error events", async () => {
            const handler = stub();
            const cs = await RawCommandStation.open(CONNECTION_STRING);
            cs.on("data", handler);
            serialPortStub.on.getCall(EventIndex.DATA).args[1](Buffer.from([1, 2, 3, 4]));
            expect(handler.callCount).to.equal(1);
            expect(handler.lastCall.args[0]).to.eql(Buffer.from([1, 2, 3, 4]));
        })
    })
})