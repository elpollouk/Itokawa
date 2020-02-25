import { expect } from "chai";
import "mocha";
import { stub, SinonStub } from "sinon";
import { application } from "../application";
import { ConfigNode } from "../utils/config";
import * as exec from "../utils/exec";
import { shutdownCheck, restartCheck, execShutdown, execRestart } from "./shutdown";


describe("Shutdown Commands", () => {
    let configeStub: SinonStub;
    let execAsyncStub: SinonStub;
    let platformStub: SinonStub;
    let config: ConfigNode;

    beforeEach(() => {
        let platform = process.platform;
        config = new ConfigNode();
        config.set("foo", "bar");
        configeStub = stub(application, "config").value(config);
        execAsyncStub = stub(exec, "execAsync").returns(Promise.resolve(""));
        platformStub = stub(process, "platform").value(platform);
    })

    afterEach(() => {
        configeStub.restore();
        execAsyncStub.restore();
        platformStub.restore();
    })

    describe("shutdownCheck", () => {
        it("should pass on Linux if no command registered", async () => {
            platformStub.value("linux");
            await shutdownCheck();
        })

        it("should fail on Windows if no command registered", async () => {
            platformStub.value("win32");
            await expect(shutdownCheck()).to.be.eventually.rejectedWith("Shutdown not configured for win32");
        })

        it("should pass on Windows if a shutdown command is registered", async () => {
            config.set("server.commands.shutdown", "shutdown");
            platformStub.value("win32");
            await shutdownCheck();
        })
    })

    describe("restartCheck", () => {
        it("should pass on Linux if no command registered", async () => {
            platformStub.value("linux");
            await restartCheck();
        })

        it("should fail on Windows if no command registered", async () => {
            platformStub.value("win32");
            await expect(restartCheck()).to.be.eventually.rejectedWith("Restart not configured for win32");
        })

        it("should pass on Windows if a restart command is registered", async () => {
            config.set("server.commands.restart", "restart");
            platformStub.value("win32");
            await restartCheck();
        })
    })

    describe("execShutdown", () => {
        it("should use the default command if no config set", async () => {
            await execShutdown();

            expect(execAsyncStub.callCount).to.equal(1);
            expect(execAsyncStub.lastCall.args).to.eql([
                "sudo shutdown -h now"
            ]);
        })

        it("should use the configured shutdown command if configured", async () => {
            config.set("server.commands.shutdown", "shutdown now");

            await execShutdown();

            expect(execAsyncStub.callCount).to.equal(1);
            expect(execAsyncStub.lastCall.args).to.eql([
                "shutdown now"
            ]);
        })
    })

    describe("execRestart", () => {
        it("should use the default command if no config set", async () => {
            await execRestart();

            expect(execAsyncStub.callCount).to.equal(1);
            expect(execAsyncStub.lastCall.args).to.eql([
                "sudo shutdown -r now"
            ]);
        })

        it("should use the configured shutdown command if configured", async () => {
            config.set("server.commands.restart", "restart now");

            await execRestart();

            expect(execAsyncStub.callCount).to.equal(1);
            expect(execAsyncStub.lastCall.args).to.eql([
                "restart now"
            ]);
        })
    })
})