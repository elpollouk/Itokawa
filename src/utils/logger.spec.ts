import { expect } from "chai";
import "mocha";
import * as sinon from "sinon";
import { LogLevel, Logger } from "./logger";

beforeEach(() => {
    Logger.testMode = true;
});

describe("Logger", () => {

    let stubConsole_log: sinon.SinonStub;
    let output: string[];

    function writeLogs(logger: Logger) {
        logger.error("Test error");
        logger.warning("Test warning");
        logger.display("Test display");
        logger.info("Test info");
        logger.debug("Test debug");
    }

    beforeEach(() => {
        Logger.testMode = false;
        output = [];

        stubConsole_log = sinon.stub(console, 'log').callsFake((text: string) => {
            output.push(text);
        });
    });

    afterEach(() => {
        Logger.testMode = true;
        stubConsole_log.restore();
        Logger.logLevel = LogLevel.NONE;
    });

    it("should log not log if level is NONE", () => {
        Logger.logLevel = LogLevel.NONE;
        let logger = new Logger("Test");

        writeLogs(logger);

        expect(output).to.be.empty;
    });

    it("should log correctly if level is ERROR", () => {
        Logger.logLevel = LogLevel.ERROR;
        let logger = new Logger("Test");

        writeLogs(logger);

        expect(output).to.eql([
            "ERROR:Test: Test error"
        ]);
    });

    it("should log correctly if level is WARNING", () => {
        Logger.logLevel = LogLevel.WARNING;
        let logger = new Logger("Test");

        writeLogs(logger);

        expect(output).to.eql([
            "ERROR:Test: Test error",
            "WARNING:Test: Test warning"
        ]);
    });

    it("should log correctly if level is DISPLAY", () => {
        Logger.logLevel = LogLevel.DISPLAY;
        let logger = new Logger("Test");

        writeLogs(logger);

        expect(output).to.eql([
            "ERROR:Test: Test error",
            "WARNING:Test: Test warning",
            "DISPLAY:Test: Test display"
        ]);
    });

    it("should log correctly if level is INFO", () => {
        Logger.logLevel = LogLevel.INFO;
        let logger = new Logger("Test");

        writeLogs(logger);

        expect(output).to.eql([
            "ERROR:Test: Test error",
            "WARNING:Test: Test warning",
            "DISPLAY:Test: Test display",
            "INFO:Test: Test info"
        ]);
    });

    it("should log correctly if level is DEBUG", () => {
        Logger.logLevel = LogLevel.DEBUG;
        let logger = new Logger("Test");

        writeLogs(logger);

        expect(output).to.eql([
            "ERROR:Test: Test error",
            "WARNING:Test: Test warning",
            "DISPLAY:Test: Test display",
            "INFO:Test: Test info",
            "DEBUG:Test: Test debug"
        ]);
    });

    it("should only call message functions if the level is active", () => {
        let displayFunc = sinon.mock().returns("display message");
        let infoFunc = sinon.mock().returns("info message");
        Logger.logLevel = LogLevel.DISPLAY;
        let logger = new Logger("Funcs");

        logger.info(infoFunc);
        logger.display(displayFunc);

        expect(displayFunc.callCount).to.equal(1);
        expect(infoFunc.callCount).to.equal(0);
        expect(output).to.eql([
            "DISPLAY:Funcs: display message"
        ]);
    });
});