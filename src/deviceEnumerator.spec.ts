import { expect } from "chai";
import "mocha";
import * as sinon from "sinon";
import { LogLevel, Logger } from "./utils/logger";

import { DeviceEnumerator } from "./deviceEnumerator";
import * as SerialPort from "serialport";

Logger.logLevel = LogLevel.NONE;

describe("Device Enumerator", () => {

    let stubSerialPort_list: sinon.SinonStub;
    let mockPorts: SerialPort.PortInfo[];

    function addPort(path: string, manufacturer: string) {
        mockPorts.push({
            path: path,
            manufacturer: manufacturer
        });
    }

    beforeEach(() => {
        mockPorts = [];

        stubSerialPort_list = sinon.stub(SerialPort, 'list').callsFake(async (): Promise<SerialPort.PortInfo[]> => {
            return mockPorts;
        });
    });

    afterEach(() => {
        stubSerialPort_list.restore();
    });

    it("should construct", () => {
        const enumerator = new DeviceEnumerator();
    });

    it("should return an empty list", async () => {
        const enumerator = new DeviceEnumerator();
        let devices = await enumerator.listDevices();
        expect(devices).to.be.empty;
    });

    it("should detect Hornby eLink on COM3", async () => {
        addPort("COM3", "Microchip Technology, Inc.");

        const enumerator = new DeviceEnumerator();
        let devices = await enumerator.listDevices();
        
        expect(devices.length).to.equal(1);
        expect(devices[0].path).to.equal("COM3");
        expect(devices[0].potentialDevices).to.contain("Hornby eLink");
    });

    it("should not detect unknown device", async () => {
        addPort("COM2", "Unknown");

        const enumerator = new DeviceEnumerator();
        let devices = await enumerator.listDevices();
        
        expect(devices.length).to.equal(1);
        expect(devices[0].path).to.equal("COM2");
        expect(devices[0].potentialDevices).to.be.empty;
    });

    it("should process multiple ports", async () => {
        addPort("/dev/ttyS0", "Unknown");
        addPort("/dev/ttyACM0", "Microchip Technology, Inc.");

        const enumerator = new DeviceEnumerator();
        let devices = await enumerator.listDevices();
        
        expect(devices.length).to.equal(2);
        expect(devices[0].path).to.equal("/dev/ttyS0");
        expect(devices[0].potentialDevices).to.be.empty;
        expect(devices[1].path).to.equal("/dev/ttyACM0");
        expect(devices[1].potentialDevices).to.contain("Hornby eLink");
    });

});