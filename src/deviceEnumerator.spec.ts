import { expect } from "chai";
import "mocha";
import * as sinon from "sinon";
import { LogLevel, Logger } from "./utils/logger";
Logger.logLevel = LogLevel.NONE;

import { DeviceEnumerator, Device } from "./deviceEnumerator";
import * as SerialPort from "serialport";
import { AsyncSerialPort } from "./serialPort/asyncSerialPort";

let MOCK_ASYNC_SERIAL_PORT = {} as AsyncSerialPort;

describe("Device Enumerator", () => {

    let stubSerialPort_list: sinon.SinonStub;
    let stubAsyncSerialPort_open: sinon.SinonStub;
    let mockPorts: SerialPort.PortInfo[];

    function addPort(path: string, manufacturer: string) {
        mockPorts.push({
            path: path,
            manufacturer: manufacturer
        });
    }

    beforeEach(() => {
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
        addPort("/dev/ttyS0", "");
        addPort("/dev/ttyACM0", "Microchip Technology Inc.");

        const enumerator = new DeviceEnumerator();
        let devices = await enumerator.listDevices();
        
        expect(devices.length).to.equal(2);
        expect(devices[0].path).to.equal("/dev/ttyS0");
        expect(devices[0].potentialDevices).to.be.empty;
        expect(devices[1].path).to.equal("/dev/ttyACM0");
        expect(devices[1].potentialDevices).to.contain("Hornby eLink");
    });

    describe("Device", () => {
        describe("open", () => {
            it("should correctly open serial port", async () => {
                let device = new Device("/dev/ttyTest", ["Hornby eLink"]);

                let port = await device.open();

                expect(port).to.equal(MOCK_ASYNC_SERIAL_PORT);
                expect(stubAsyncSerialPort_open.callCount).to.be.equal(1);
                expect(stubAsyncSerialPort_open.getCall(0).args[0]).to.equal("/dev/ttyTest");
                expect(stubAsyncSerialPort_open.getCall(0).args[1]).to.eql({baudRate:115200});
            });
        });
    });
});