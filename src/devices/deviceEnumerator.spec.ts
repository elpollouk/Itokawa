import { expect } from "chai";
import "mocha";
import { SinonStub, stub, restore } from "sinon";

import { DeviceEnumerator } from "./deviceEnumerator";
import { registerCommandStations } from "./commandStations/commandStationDirectory";
import * as SerialPort from "serialport";
import { NullCommandStation } from "./commandStations/null";
import { ICommandStationConstructable } from "./commandStations/commandStation";
import { CommanderStatic } from "commander";
import { application } from "../application";

const ELINK_PNPID_WIN = "USB\\VID_04D8&PID_000A\\6&3A757EEC&1&2";

registerCommandStations();

describe("Device Enumerator", () => {

    let stubSerialPort_list: SinonStub;
    let mockPorts: SerialPort.PortInfo[];
    let args: CommanderStatic;

    function addPort(path: string, manufacturer: string, pnpId?: string) {
        mockPorts.push({
            path: path,
            manufacturer: manufacturer,
            pnpId: pnpId
        });
    }

    beforeEach(() => {
        mockPorts = [];
        args = {} as CommanderStatic;

        stubSerialPort_list = stub(SerialPort, 'list').returns(Promise.resolve(mockPorts));
        application.commandStation = null;
    });

    afterEach(() => {
        restore();
    });

    it("should construct", () => {
        const enumerator = new DeviceEnumerator();
    });

    it("should return an empty list", async () => {
        let devices = await DeviceEnumerator.listDevices();
        expect(devices).to.be.empty;
    });

    it("should detect eLink on COM3", async () => {
        addPort("COM3", "Microchip Technology, Inc.", ELINK_PNPID_WIN);

        let devices = await DeviceEnumerator.listDevices();
        
        expect(devices.length).to.equal(1);
        expect(devices[0].name).to.equal("eLink on COM3");
        expect(devices[0].commandStation).to.equal("eLink");
        expect(devices[0].path).to.equal("COM3");
        expect(devices[0].manufacturer).to.equal("Microchip Technology, Inc.");
        expect(devices[0].pnpId).to.equal(ELINK_PNPID_WIN);
        expect(devices[0].open).to.be.an.instanceOf(Function);
    });

    it("should not detect unknown device", async () => {
        addPort("COM2", "Unknown");

        let devices = await DeviceEnumerator.listDevices();
        
        expect(devices.length).to.equal(0);
    });

    it("should process multiple ports", async () => {
        addPort("/dev/ttyS0", "");
        addPort("/dev/ttyACM0", "Microchip Technology Inc.", ELINK_PNPID_WIN);

        let devices = await DeviceEnumerator.listDevices();
        
        expect(devices.length).to.equal(1);
        expect(devices[0].name).to.equal("eLink on /dev/ttyACM0");
        expect(devices[0].commandStation).to.equal("eLink");
        expect(devices[0].path).to.equal("/dev/ttyACM0");
        expect(devices[0].manufacturer).to.equal("Microchip Technology Inc.");
        expect(devices[0].pnpId).to.equal(ELINK_PNPID_WIN);
        expect(devices[0].open).to.be.an.instanceOf(Function);
    });

    it("should generate a valid connector function for command stations", async () => {
        addPort("/dev/ttyS0", "__TEST__");

        let devices = await DeviceEnumerator.listDevices();
        let cs = await devices[0].open();

        expect(cs).to.be.an.instanceOf(NullCommandStation);
    });

    it ("should be possible to open a registered device directly", async () => {
        let cs = await DeviceEnumerator.openDevice(NullCommandStation.deviceId, "Foo=Bar");

        expect(cs).to.be.instanceOf(NullCommandStation);
    });

    it ("should provide a default empty command string if none supplied by caller", async () => {
        const testDevice = {
            open: stub().returns({})
        }
        await DeviceEnumerator.openDevice(testDevice as unknown as ICommandStationConstructable);

        expect(testDevice.open.callCount).to.equal(1);
        expect(testDevice.open.lastCall.args).to.eql([
            ""
        ]);
    });

    it ("should fail if attempting to open an invalid device directly", () => {
        expect(() => DeviceEnumerator.openDevice("Invalid", "Foo")).to.throw();
    });

    describe("monitorForDevice", () => {
        it("should start monitoring is no devices are initially connected", async () => {
            const setTimeoutStub = stub(global, "setTimeout");
            await DeviceEnumerator.monitorForDevice(args);

            expect(setTimeoutStub.callCount).to.equal(1);
            expect(setTimeoutStub.lastCall.args[0]).to.be.instanceOf(Function);
            expect(setTimeoutStub.lastCall.args[1]).to.equal(5000);
        })

        it("should set the application command station if one is detected", async () => {
            addPort("/dev/ttyS0", "__TEST__");
            const setTimeoutStub = stub(global, "setTimeout");

            await DeviceEnumerator.monitorForDevice(args);

            expect(setTimeoutStub.callCount).to.equal(0);
            expect(application.commandStation).to.be.instanceOf(NullCommandStation);
        })
    })
});