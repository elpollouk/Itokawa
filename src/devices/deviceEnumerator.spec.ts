import { expect } from "chai";
import "mocha";
import { SinonStub, stub, restore } from "sinon";

import { DeviceEnumerator } from "./deviceEnumerator";
import { registerCommandStations } from "./commandStations/commandStationDirectory";
import { SerialPort } from "serialport";
import { PortInfo } from "@serialport/bindings-cpp";
import { NullCommandStation } from "./commandStations/null";
import { ICommandStationConstructable } from "./commandStations/commandStation";
import { application } from "../application";
import { ConfigNode } from "../utils/config";
import { nextTick } from "../utils/promiseUtils";

const ELINK_PNPID_WIN = "USB\\VID_04D8&PID_000A\\6&3A757EEC&1&2";

registerCommandStations();

describe("Device Enumerator", () => {

    let stubSerialPort_list: SinonStub;
    let mockPorts: PortInfo[];
    let args: any;

    function addPort(path: string, manufacturer: string, pnpId?: string) {
        mockPorts.push({
            path: path,
            manufacturer: manufacturer,
            pnpId: pnpId,
            locationId: undefined,
            productId: undefined,
            vendorId: undefined,
            serialNumber: undefined
        });
    }

    beforeEach(() => {
        mockPorts = [];
        args = {};

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

        let setTimeoutStub: SinonStub;
        let config: ConfigNode;

        beforeEach(() => {
            config = new ConfigNode();

            setTimeoutStub = stub(global, "setTimeout");
            stub(application, "config").value(config);
        })

        afterEach(() => {
            restore();
        })

        it("should start monitoring is no devices are initially connected", async () => {
            await DeviceEnumerator.monitorForDevice(args);

            expect(setTimeoutStub.callCount).to.equal(1);
            expect(setTimeoutStub.lastCall.args[0]).to.be.instanceOf(Function);
            expect(setTimeoutStub.lastCall.args[1]).to.equal(5000);
        })

        it("should be possible to specify the monitor retry time in the application config", async () => {
            config.set("application.commandStation.retryTime", 10000);

            await DeviceEnumerator.monitorForDevice(args);

            expect(setTimeoutStub.callCount).to.equal(1);
            expect(setTimeoutStub.lastCall.args[0]).to.be.instanceOf(Function);
            expect(setTimeoutStub.lastCall.args[1]).to.equal(10000);
        })

        it("should set the application command station if one is detected", async () => {
            addPort("/dev/ttyS0", "__TEST__");

            await DeviceEnumerator.monitorForDevice(args);

            expect(setTimeoutStub.callCount).to.equal(0);
            expect(application.commandStation).to.be.instanceOf(NullCommandStation);
        })

        it("should use device settings from command line args even if detectable device is available", async () => {
            addPort("COM3", "Microchip Technology, Inc.", ELINK_PNPID_WIN);
            args.device = "NullCommandStation";

            await DeviceEnumerator.monitorForDevice(args);

            expect(application.commandStation).to.be.instanceOf(NullCommandStation);
        })

        it("should use device settings from command line args even if config.xml specifies a device", async () => {
            config.set("application.commandStation.device", "ELinkCommandStation");
            args.device = "NullCommandStation";

            await DeviceEnumerator.monitorForDevice(args);

            expect(application.commandStation).to.be.instanceOf(NullCommandStation);
        })

        it("should use device settings from config.xml even if a detectable device is available", async () => {
            addPort("COM3", "Microchip Technology, Inc.", ELINK_PNPID_WIN);
            config.set("application.commandStation.device", "NullCommandStation");

            await DeviceEnumerator.monitorForDevice(args);

            expect(application.commandStation).to.be.instanceOf(NullCommandStation);
        })

        it("should deregister handler and schedule a retry if a command station error occurs", async () => {
            addPort("/dev/ttyS0", "__TEST__");
            await DeviceEnumerator.monitorForDevice(args);
            const cs = application.commandStation as NullCommandStation;
            const offStub = stub(cs, "off");

            cs.emit("error", new Error("Test Error"));
            await nextTick();

            expect(offStub.callCount).to.equal(1);
            expect(offStub.lastCall.args[0]).to.equal("error");
            expect(offStub.lastCall.args[1]).to.be.instanceOf(Function);
            expect(setTimeoutStub.callCount).to.equal(1);
            expect(setTimeoutStub.lastCall.args[0]).to.be.instanceOf(Function);
            expect(setTimeoutStub.lastCall.args[1]).to.equal(5000);
        })

        it("should close previous and open a new command station instance when attempting a recovery", async () => {
            addPort("/dev/ttyS0", "__TEST__");
            await DeviceEnumerator.monitorForDevice(args);
            const cs = application.commandStation as NullCommandStation;
            const closeStub = stub(cs, "close");
            cs.emit("error", new Error("Test Error"));
            await nextTick();

            const callback = setTimeoutStub.lastCall.args[0];
            callback();
            await nextTick();

            expect(closeStub.callCount).to.equal(1);
            expect(application.commandStation).to.be.instanceOf(NullCommandStation);
            expect(application.commandStation).to.not.equal(cs);
        })
    })
});
