import { expect } from "chai";
import "mocha";
import { stub, SinonStub } from "sinon";
import { execAsync, spawnAsync } from "./exec";
import * as child_process from "child_process";

const TEST_COMMAND = "node testdata/exec/exectest.js";
const TEST_COMMAND_NO_OUTPUT = "node testdata/exec/exectest_nooutput.js";
const TEST_COMMAND_UTF8 = "node testdata/exec/utf8.js";

const TIMEOUT = 10000;

describe("Exec", () => {
    describe("execAsync", () => {
        it("should return stdout string on success", async () => {
            const output = await execAsync(TEST_COMMAND);
            expect(output).to.equal("Hello World!\nstdout data\n");
        }).timeout(TIMEOUT)

        it("should return emptry string if now output", async () => {
            const output = await execAsync(TEST_COMMAND_NO_OUTPUT);
            expect(output).to.equal("");
        }).timeout(TIMEOUT)

        it("should reject with an error if command exits with an error", async () => {
            const promise = execAsync(TEST_COMMAND + " 123");
            await expect(promise).to.be.eventually.rejectedWith("Process exited with code 123");
        }).timeout(TIMEOUT)

        it("should reject with an error if command is not valid", async () => {
            const promise = execAsync("sdgdas");
            await expect(promise).to.be.eventually.rejected;
        }).timeout(TIMEOUT)
    })

    describe("spawnAsync", () => {
        it("should return 0 on succesfully execution", async () => {
            const output = stub();
            const exitCode = await spawnAsync(TEST_COMMAND, output, output);
            expect(exitCode).to.equal(0);
        }).timeout(TIMEOUT)

        it("should return the exit code of a failed command", async () => {
            const output = stub();
            const exitCode = await spawnAsync(TEST_COMMAND + " 123", output, output);
            expect(exitCode).to.equal(123);
        }).timeout(TIMEOUT)

        it("should return a non-zero exit code for an invalid command", async () => {
            const output = stub();
            const exitCode = await spawnAsync("sgsdfg", output, output);
            expect(exitCode).to.not.equal(0);
        }).timeout(TIMEOUT)

        it("should return stdout and stderr via the correct callbacks", async () => {
            const stdout = stub();
            const stderr = stub();
            await spawnAsync(TEST_COMMAND, stdout, stderr);
            
            expect(stdout.callCount).to.equal(2);
            expect(stdout.getCall(0).args).to.eql(["Hello World!\n"]);
            expect(stdout.getCall(1).args).to.eql(["stdout data\n"]);
            expect(stderr.callCount).to.equal(1);
            expect(stderr.getCall(0).args).to.eql(["stderr data\n"]);
        }).timeout(TIMEOUT)

        it("should decode UTF8 data", async () => {
            const stdout = stub();
            const stderr = stub();
            await spawnAsync(TEST_COMMAND_UTF8, stdout, stderr);
            
            expect(stdout.callCount).to.equal(1);
            expect(stdout.lastCall.args).to.eql(["stdout: 糸川\n"]);
            expect(stderr.callCount).to.equal(1);
            expect(stderr.lastCall.args).to.eql(["stderr: 糸川\n"]);
        }).timeout(TIMEOUT)

        it("should decode UTF8 data", async () => {
            const stdout = stub();
            const stderr = stub();
            await spawnAsync(TEST_COMMAND_UTF8, stdout, stderr);
            
            expect(stdout.callCount).to.equal(1);
            expect(stdout.lastCall.args).to.eql(["stdout: 糸川\n"]);
            expect(stderr.callCount).to.equal(1);
            expect(stderr.lastCall.args).to.eql(["stderr: 糸川\n"]);
        }).timeout(TIMEOUT)

        describe("Vanilla string data handling", () => {
            let spawnStub: SinonStub;
            let processMock: any;
            beforeEach(() => {
                processMock = {
                    on: stub(),
                    stdout: {
                        on: stub()
                    },
                    stderr: {
                        on: stub()
                    }
                };
                spawnStub = stub(child_process, "spawn").returns(processMock)
            })

            afterEach(() => {
                spawnStub.restore();
            })

            it("should pass vanilla strings from stdout", async () => {
                const stdout = stub();
                const stderr = stub();
                const promise = spawnAsync(TEST_COMMAND_UTF8, stdout, stderr);

                processMock["stdout"]["on"].lastCall.args[1]("ABCDEF");

                await processMock["on"].lastCall.args[1]();
                await promise;

                expect(stdout.callCount).to.equal(1);
                expect(stdout.lastCall.args).to.eql(["ABCDEF"]);
            }).timeout(TIMEOUT)

            it("should pass vanilla strings from stderr", async () => {
                const stdout = stub();
                const stderr = stub();
                const promise = spawnAsync(TEST_COMMAND_UTF8, stdout, stderr);

                processMock["stderr"]["on"].lastCall.args[1]("12345");

                await processMock["on"].lastCall.args[1]();
                await promise;

                expect(stderr.callCount).to.equal(1);
                expect(stderr.lastCall.args).to.eql(["12345"]);
            }).timeout(TIMEOUT)
        })
    })
})