import { expect } from "chai";
import "mocha";
import { stub, SinonStub, createStubInstance, SinonStubbedInstance } from "sinon";
import { application } from "../application";
import { ConfigNode } from "../utils/config";
import * as exec from "../utils/exec";
import { execShutdown, execRestart } from "./shutdown";



describe("Shutdown Commands", () => {
    let configeStub: SinonStub;
    let execAsyncStub: SinonStub;
    let config: ConfigNode;

    beforeEach(() => {
        config = new ConfigNode();
        config.set("foo", "bar");
        configeStub = stub(application, "config").value(config);
        execAsyncStub = stub(exec, "execAsync").returns(Promise.resolve(""));
    })

    afterEach(() => {
        configeStub.restore();
        execAsyncStub.restore();
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