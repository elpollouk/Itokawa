import { expect } from "chai";
import "mocha";
import * as sinon from "sinon";
import { LogLevel, Logger } from "./logger";

Logger.logLevel = LogLevel.NONE;

describe("Logger", () => {

    let stubConsole_log: sinon.SinonStub;
    let output: string[];

    function writeLogs(logger: Logger) {
        logger.error("Test error");
        logger.warning("Test warning");
        logger.info("Test info");
        logger.debug("Test debug");
    }

    beforeEach(() => {
        output = [];

        stubConsole_log = sinon.stub(console, 'log').callsFake((text: string) => {
            output.push(text);
        });
    });

    afterEach(() => {
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

    it("should log correctly if level is INFO", () => {
        Logger.logLevel = LogLevel.INFO;
        let logger = new Logger("Test");

        writeLogs(logger);

        expect(output).to.eql([
            "ERROR:Test: Test error",
            "WARNING:Test: Test warning",
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
            "INFO:Test: Test info",
            "DEBUG:Test: Test debug"
        ]);
    });
});