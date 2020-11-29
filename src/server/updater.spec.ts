import { expect } from "chai";
import "mocha";
import { stub, SinonStub, restore } from "sinon";
import { application } from "../application";
import { ConfigNode } from "../utils/config";
import { SignalablePromise } from "../utils/promiseUtils";

import * as updater from "./updater";

describe("Updater", () => {
    let spawnAsyncStub: SinonStub;
    let lifecycleBeginSensitiveOperation: SinonStub;
    let endOperation: SinonStub;
    let sender: SinonStub;
    let platformStub: SinonStub;
    let spawnExitCode = 0;

    beforeEach(() => {
        spawnExitCode = 0;
        spawnAsyncStub = stub(updater, "_spawnAsync").callsFake(() => Promise.resolve(spawnExitCode));
        endOperation = stub();
        lifecycleBeginSensitiveOperation = stub(application.lifeCycle, "beginSensitiveOperation").returns(endOperation);
        sender = stub().callsFake(() => Promise.resolve());

        platformStub = stub(process, "platform").value("linux");
    })

    afterEach(async () => {
        restore();
    })

    describe("updateApplication", () => {
        it("should issue default update command if not specified in config", async () => {
            await updater.updateApplication(sender);
            expect(lifecycleBeginSensitiveOperation.callCount).to.equal(1);
            expect(lifecycleBeginSensitiveOperation.lastCall.args).to.eql(["updateApplication"]);
            expect(spawnAsyncStub.callCount).to.equal(1);
            expect(spawnAsyncStub.lastCall.args[0]).to.equal("npm run prod-update");
            expect(sender.lastCall.args[0]).to.eql({
                lastMessage: true,
                data: "\nUpdate complete!"
            });
            expect(endOperation.callCount).to.equal(1);
        })

        it("should pick up custom update command from config.xml", async () => {
            const config = new ConfigNode();
            config.set("server.commands.update", "bash update.sh");
            stub(application, "config").value(config);

            await updater.updateApplication(sender);
            expect(spawnAsyncStub.callCount).to.equal(1);
            expect(spawnAsyncStub.lastCall.args[0]).to.equal("bash update.sh");
        })

        it("should be possible to run another update after the first finishes", async () => {
            await updater.updateApplication(sender);
            await updater.updateApplication(sender);
            expect(spawnAsyncStub.callCount).to.equal(2);
            expect(lifecycleBeginSensitiveOperation.callCount).to.equal(2);
        })

        it("should reject if a life cycle action is in progress", async () => {
            lifecycleBeginSensitiveOperation.throws(new Error("Life cycle busy"));
            await expect(updater.updateApplication(sender)).to.be.eventually.rejectedWith("Life cycle busy");
        })

        it("should report a failed update attempt", async () => {
            spawnExitCode = 1;
            await expect(updater.updateApplication(sender)).to.be.eventually.rejectedWith("Update failed, process exited with code 1");
            expect(endOperation.callCount).to.equal(1);
        })

        it("should send stdout", async () => {
            const spawnPromise = new SignalablePromise<number>();
            spawnAsyncStub.returns(spawnPromise);

            const updatePromise = updater.updateApplication(sender);
            spawnAsyncStub.lastCall.args[1]("stdout data");

            // Finish up the 
            spawnPromise.resolve(0);
            await updatePromise;

            expect(sender.callCount).to.equal(2);
            expect(sender.getCall(0).args).to.eql([{
                lastMessage: false,
                data: "stdout data"
            }]);
        })

        it("should send stderr", async () => {
            const spawnPromise = new SignalablePromise<number>();
            spawnAsyncStub.returns(spawnPromise);

            const updatePromise = updater.updateApplication(sender);
            spawnAsyncStub.lastCall.args[2]("stderr data");

            spawnPromise.resolve(0);
            await updatePromise;

            expect(sender.callCount).to.equal(2);
            expect(sender.getCall(0).args).to.eql([{
                lastMessage: false,
                error: "stderr data"
            }]);
        })
    })

    describe("updateOS", () => {
        it("issue the correct command", async () => {
            await updater.updateOS(sender);
            expect(lifecycleBeginSensitiveOperation.callCount).to.equal(1);
            expect(lifecycleBeginSensitiveOperation.lastCall.args).to.eql(["updateOS"]);
            expect(spawnAsyncStub.callCount).to.equal(1);
            expect(spawnAsyncStub.lastCall.args[0]).to.equal("sudo apt-get update && sudo apt-get -y dist-upgrade");
            expect(sender.lastCall.args[0]).to.eql({
                lastMessage: true,
                data: "\nUpdate complete!"
            });
            expect(endOperation.callCount).to.equal(1);
        })

        it("should be possible to run another update after the first finishes", async () => {
            await updater.updateOS(sender);
            await updater.updateOS(sender);
            expect(spawnAsyncStub.callCount).to.equal(2);
            expect(lifecycleBeginSensitiveOperation.callCount).to.equal(2);
        })

        it("should reject if a life cycle action is in progress", async () => {
            lifecycleBeginSensitiveOperation.throws(new Error("Life cycle busy"));
            await expect(updater.updateOS(sender)).to.be.eventually.rejectedWith("Life cycle busy");
        })

        it("should report a failed update attempt", async () => {
            spawnExitCode = 1;
            await expect(updater.updateOS(sender)).to.be.eventually.rejectedWith("Update failed, process exited with code 1");
            expect(endOperation.callCount).to.equal(1);
        })

        it("should send stdout", async () => {
            const spawnPromise = new SignalablePromise<number>();
            spawnAsyncStub.returns(spawnPromise);

            const updatePromise = updater.updateOS(sender);
            spawnAsyncStub.lastCall.args[1]("stdout data");

            // Finish up the 
            spawnPromise.resolve(0);
            await updatePromise;

            expect(sender.callCount).to.equal(2);
            expect(sender.getCall(0).args).to.eql([{
                lastMessage: false,
                data: "stdout data"
            }]);
        })

        it("should send stderr", async () => {
            const spawnPromise = new SignalablePromise<number>();
            spawnAsyncStub.returns(spawnPromise);

            const updatePromise = updater.updateOS(sender);
            spawnAsyncStub.lastCall.args[2]("stderr data");

            spawnPromise.resolve(0);
            await updatePromise;

            expect(sender.callCount).to.equal(2);
            expect(sender.getCall(0).args).to.eql([{
                lastMessage: false,
                error: "stderr data"
            }]);
        })

        it("should not run under Windows if no command specified", async () => {
            platformStub.value("win32");
            await expect(updater.updateOS(sender)).to.be.eventually.rejectedWith("OS update not configured for win32");
        })

        it("should run on Windows if an explicit command is set", async () => {
            platformStub.value("win32");
            const config = new ConfigNode();
            config.set("server.commands.updateOS", "wup.ps1");
            stub(application, "config").value(config);

            await updater.updateOS(sender);

            expect(spawnAsyncStub.callCount).to.equal(1);
            expect(spawnAsyncStub.lastCall.args[0]).to.equal("wup.ps1");
        })
    })
})
