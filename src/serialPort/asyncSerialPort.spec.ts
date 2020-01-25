import { expect, use } from "chai";
import * as chaiAsPromised from "chai-as-promised";
use(chaiAsPromised);

import "mocha";
import { spy, SinonSpy } from "sinon";
import { LogLevel, Logger } from "../utils/logger";
Logger.logLevel = LogLevel.NONE;

import { AsyncSerialPort } from "./asyncSerialPort";
const SerialPort = require('@serialport/stream');
const MockBinding = require('@serialport/binding-mock');

const TEST_PORT = "/dev/ttyTest";

describe("AsyncSerialPort", () => {
    let openSpy: SinonSpy;
    beforeEach(() => {
        SerialPort.Binding = MockBinding;
        MockBinding.createPort(TEST_PORT);
        openSpy = spy(MockBinding.prototype, "open");
    });

    afterEach(() => {
        openSpy.restore();
    });

    describe("open", () => {
        it("should pass through correct options", async () => {
            const options = { baudRate: 28800 };
            let port = await AsyncSerialPort.open(TEST_PORT, options);

            expect(openSpy.getCall(0).args[0]).to.equal(TEST_PORT);
            expect(openSpy.getCall(0).args[1].baudRate).to.equal(options.baudRate);
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
});