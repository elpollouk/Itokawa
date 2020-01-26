import { expect } from "chai";
import "mocha";
import * as sinon from "sinon";
import { Logger } from "./utils/logger";

import { DeviceEnumerator, Device } from "./deviceEnumerator";
import * as SerialPort from "serialport";
import { AsyncSerialPort } from "./devices/asyncSerialPort";
import { MockCommandStation } from "./devices/commandStations/commandStation.mock";

const MOCK_ASYNC_SERIAL_PORT = {} as AsyncSerialPort;
const ELINK_PNPID_WIN = "USB\\VID_04D8&PID_000A\\6&3A757EEC&1&2";

describe("Device Enumerator", () => {

    let stubSerialPort_list: sinon.SinonStub;
    let stubAsyncSerialPort_open: sinon.SinonStub;
    let mockPorts: SerialPort.PortInfo[];

    function addPort(path: string, manufacturer: string, pnpId?: string) {
        mockPorts.push({
            path: path,
            manufacturer: manufacturer,
            pnpId: pnpId
        });
    }

    beforeEach(() => {
        Logger.testMode = true;
        mockPorts = [];

        stubSerialPort_list = sinon.stub(SerialPort, 'list').returns(Promise.resolve(mockPorts));
        stubAsyncSerialPort_open = sinon.stub(AsyncSerialPort, "open").returns(Promise.resolve(MOCK_ASYNC_SERIAL_PORT));
    });

    afterEach(() => {
        stubSerialPort_list.restore();
        stubAsyncSerialPort_open.restore();
    });

    it("should construct", () => {
        const enumerator = new DeviceEnumerator();
    });

    it("should return an empty list", async () => {
        const enumerator = new DeviceEnumerator();
        let devices = await enumerator.listDevices();
        expect(devices).to.be.empty;
    });

    it("should detect eLink on COM3", async () => {
        addPort("COM3", "Microchip Technology, Inc.", ELINK_PNPID_WIN);

        const enumerator = new DeviceEnumerator();
        let devices = await enumerator.listDevices();
        
        expect(devices.length).to.equal(1);
        expect(devices[0].name).to.equal("eLink on COM3");
        expect(devices[0].commandStation).to.equal("eLink");
        expect(devices[0].path).to.equal("COM3");
        expect(devices[0].manufacturer).to.equal("Microchip Technology, Inc.");
        expect(devices[0].pnpId).to.equal(ELINK_PNPID_WIN);
        expect(devices[0].connect).to.be.an.instanceOf(Function);
    });

    it("should not detect unknown device", async () => {
        addPort("COM2", "Unknown");

        const enumerator = new DeviceEnumerator();
        let devices = await enumerator.listDevices();
        
        expect(devices.length).to.equal(0);
    });

    it("should process multiple ports", async () => {
        addPort("/dev/ttyS0", "");
        addPort("/dev/ttyACM0", "Microchip Technology Inc.", ELINK_PNPID_WIN);

        const enumerator = new DeviceEnumerator();
        let devices = await enumerator.listDevices();
        
        expect(devices.length).to.equal(1);
        expect(devices[0].name).to.equal("eLink on /dev/ttyACM0");
        expect(devices[0].commandStation).to.equal("eLink");
        expect(devices[0].path).to.equal("/dev/ttyACM0");
        expect(devices[0].manufacturer).to.equal("Microchip Technology Inc.");
        expect(devices[0].pnpId).to.equal(ELINK_PNPID_WIN);
        expect(devices[0].connect).to.be.an.instanceOf(Function);
    });

    it("should generate a valid connector function for command stations", async () => {
        addPort("/dev/ttyS0", "__TEST__");

        const enumerator = new DeviceEnumerator();
        let devices = await enumerator.listDevices();
        let cs = await devices[0].connect();

        expect(cs).to.be.an.instanceOf(MockCommandStation);
    });
});