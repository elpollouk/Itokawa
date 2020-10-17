import { expect } from "chai";
import "mocha";
import { stub, SinonStub } from "sinon";
import * as executor from "./executor"

const TEST_COMMANDS: {[key: string]: executor.Command} = {
    "out": (context: executor.CommandContext, params: string[]) => {
        for (const param of params) context.out(param);
        return Promise.resolve();
    },
    "error": (context: executor.CommandContext, params: string[]) => {
        for (const param of params) context.error(param);
        return Promise.resolve();
    },
    "throw": (context: executor.CommandContext, params: string[]) => {
        throw Error(params[0]);
    },
    "ignore": (c, p) => Promise.resolve()
}

TEST_COMMANDS.throw.minArgs = 1;
TEST_COMMANDS.throw.maxArgs = 1;
TEST_COMMANDS.ignore.notCommand = true;


describe("Executor", () => {
    let context: executor.CommandContext = null;
    let outStub: SinonStub = null;
    let errorStub: SinonStub = null;

    beforeEach(() => {
        executor.clearCommands();
        outStub = stub();
        errorStub = stub();
        context = {
            out: outStub,
            error: errorStub
        };
    })

    describe("help", () => {
        it("should be the only command registered by default", async () => {
            await executor.execCommand(context, "help");
            expect(outStub.callCount).to.equal(3);
            expect(errorStub.callCount).to.equal(0);
            expect(outStub.getCall(0).args).to.eql(["Available commands:"]);
            expect(outStub.getCall(1).args).to.eql(["  help"]);
            expect(outStub.getCall(2).args).to.eql(["OK"]);
        })

        it("should suppress 'OK' if requested", async () => {
            await executor.execCommand(context, "help", true);
            expect(outStub.callCount).to.equal(2);
            expect(errorStub.callCount).to.equal(0);
            expect(outStub.getCall(0).args).to.eql(["Available commands:"]);
            expect(outStub.getCall(1).args).to.eql(["  help"]);
        })

        it("should list all registered valid commands alphabetically", async () => {
            executor.registerCommands(TEST_COMMANDS, {
                "foo": () => {},
                "bar": () => {},
                "not a command": "XXXX"
            });
            await executor.execCommand(context, "help", true);
            expect(outStub.callCount).to.equal(7);
            expect(errorStub.callCount).to.equal(0);
            expect(outStub.getCall(0).args).to.eql(["Available commands:"]);
            expect(outStub.getCall(1).args).to.eql(["  bar"]);
            expect(outStub.getCall(2).args).to.eql(["  error"]);
            expect(outStub.getCall(3).args).to.eql(["  foo"]);
            expect(outStub.getCall(4).args).to.eql(["  help"]);
            expect(outStub.getCall(5).args).to.eql(["  out"]);
            expect(outStub.getCall(6).args).to.eql(["  throw"]);
        })

        it("should return the help for the specified command", async () => {
            await executor.execCommand(context, "help help");
            expect(outStub.callCount).to.equal(2);
            expect(errorStub.callCount).to.equal(0);
            expect(outStub.getCall(0).args).to.eql(["Lists available commands or retrieves help on a command\n  Usage: help [COMMAND_NAME]"]);
            expect(outStub.getCall(1).args).to.eql(["OK"]);
        })

        it("should raise error if command is not registered", async () => {
            await expect(executor.execCommand(context, "help foo")).to.be.eventually.rejectedWith("Unrecognised command 'foo'");
        })

        it("should raise error if command has no help", async () => {
            executor.registerCommands(TEST_COMMANDS);
            await expect(executor.execCommand(context, "help out")).to.be.eventually.rejectedWith("out is not helpful");
        })
    })

    describe("Error Handling", () => {
        it("should report command not found error when using execCommandSafe", async () => {
            await executor.execCommandSafe(context, "foo");
            expect(outStub.callCount).to.equal(0);
            expect(errorStub.callCount).to.equal(1);
            expect(errorStub.lastCall.args).to.eql(["Unrecognised command 'foo'"]);
        })

        it("should raise a not found error when using execCommand", async () => {
            await expect(executor.execCommand(context, "foo")).to.be.eventually.rejectedWith("Unrecognised command 'foo'");
        })

        it("should report command errors when using execCommandSafe", async () => {
            executor.registerCommands(TEST_COMMANDS);
            await executor.execCommandSafe(context, 'throw "Test Error"');
            expect(outStub.callCount).to.equal(0);
            expect(errorStub.callCount).to.equal(1);
            expect(errorStub.lastCall.args).to.eql(["Test Error"]);
        })

        it("should raise command errors when using execCommand", async () => {
            executor.registerCommands(TEST_COMMANDS);
            await expect(executor.execCommand(context, 'throw "Test Error"')).to.be.eventually.rejectedWith("Test Error");
        })

        it("should not fail commands that produce error messages", async () => {
            executor.registerCommands(TEST_COMMANDS);
            await executor.execCommand(context, "error a b c");
            expect(outStub.callCount).to.equal(1);
            expect(outStub.lastCall.args).to.eql(["OK"]);
            expect(errorStub.callCount).to.equal(3);
            expect(errorStub.getCall(0).args).to.eql(["a"]);
            expect(errorStub.getCall(1).args).to.eql(["b"]);
            expect(errorStub.getCall(2).args).to.eql(["c"]);
        })

        it("should reject commands with too few arguments", async () => {
            executor.registerCommands(TEST_COMMANDS);
            await expect(executor.execCommand(context, 'throw')).to.be.eventually.rejectedWith("throw expects at least 1 args");
        })

        it("should reject commands with too many arguments", async () => {
            executor.registerCommands(TEST_COMMANDS);
            await expect(executor.execCommand(context, 'throw foo bar')).to.be.eventually.rejectedWith("throw expects at most 1 args");
        })

        it("should ignore empty command strings", async () => {
            await executor.execCommand(context, "    ");
            expect(outStub.callCount).to.equal(0);
            expect(errorStub.callCount).to.equal(0);
        })
    })
})