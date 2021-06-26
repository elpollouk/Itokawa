import { expect } from "chai";
import "mocha";
import { stub } from "sinon";
import { Command } from "commander";
import { Logger, LogLevel } from "./logger";
let pjson = require('../../package.json');

import * as commandLineArgs  from "./commandLineArgs";

describe("Command Line args", () => {
    describe("addCommonOptions", () => {
        it("should add all the common options", () => {
            const options = new Set<string>();
            const commander = {};
            commander["version"] = stub().returns(commander);
            commander["option"] = stub().callsFake((flag) => {
                options.add(flag);
                return commander;
            });

            commandLineArgs.addCommonOptions(commander as Command);

            expect(commander["version"].lastCall.args).to.eql([ pjson.version ]);
            expect(options.size).to.equal(5);
            expect(options).to.contain("-d --device <device>");
            expect(options).to.contain("-c --connection-string <connectionString>");
            expect(options).to.contain("--log-level <loglevel>");
            expect(options).to.contain("--features <feature flags>");
            expect(options).to.contain("--profile <profile>");
        })
    })

    describe("applyLogLevel", () => {
        let originalLogLevel: LogLevel;
        beforeEach(() => {
            originalLogLevel = Logger.logLevel;
            Logger.logLevel = null;
        })

        afterEach(() => {
            Logger.logLevel = originalLogLevel;
        })

        it("should do nothing if option not set", () => {
            commandLineArgs.applyLogLevel({} as Command);
            expect(Logger.logLevel).to.be.null;
        })

        it("should parse valid level", () => {
            commandLineArgs.applyLogLevel({
                logLevel: "debug"
            } as unknown as Command);
            expect(Logger.logLevel).to.equal(LogLevel.DEBUG);
        })

        it("should ignore invalid level", () => {
            commandLineArgs.applyLogLevel({
                logLevel: "foo"
            } as unknown as Command);
            expect(Logger.logLevel).to.be.null;
        })
    })
})