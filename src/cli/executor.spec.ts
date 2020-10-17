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
            error: errorStub,
            vars: {}
        };
    })

    describe("help", () => {
        it("should list only built in commands by default", async () => {
            await executor.execCommand(context, "help");
            expect(outStub.callCount).to.equal(5);
            expect(errorStub.callCount).to.equal(0);
            expect(outStub.getCall(0).args).to.eql(["Available commands:"]);
            expect(outStub.getCall(1).args).to.eql(["  help"]);
            expect(outStub.getCall(2).args).to.eql(["  set"]);
            expect(outStub.getCall(3).args).to.eql(["  unset"]);
            expect(outStub.getCall(4).args).to.eql(["OK"]);
        })

        it("should suppress 'OK' if requested", async () => {
            await executor.execCommand(context, "help", true);
            expect(outStub.callCount).to.equal(4);
            expect(errorStub.callCount).to.equal(0);
            expect(outStub.getCall(0).args).to.eql(["Available commands:"]);
            expect(outStub.getCall(1).args).to.eql(["  help"]);
            expect(outStub.getCall(2).args).to.eql(["  set"]);
            expect(outStub.getCall(3).args).to.eql(["  unset"]);
        })

        it("should list all registered valid commands alphabetically", async () => {
            executor.registerCommands(TEST_COMMANDS, {
                "foo": () => {},
                "bar": () => {},
                "not a command": "XXXX"
            });
            await executor.execCommand(context, "help", true);
            expect(outStub.callCount).to.equal(9);
            expect(errorStub.callCount).to.equal(0);
            expect(outStub.getCall(0).args).to.eql(["Available commands:"]);
            expect(outStub.getCall(1).args).to.eql(["  bar"]);
            expect(outStub.getCall(2).args).to.eql(["  error"]);
            expect(outStub.getCall(3).args).to.eql(["  foo"]);
            expect(outStub.getCall(4).args).to.eql(["  help"]);
            expect(outStub.getCall(5).args).to.eql(["  out"]);
            expect(outStub.getCall(6).args).to.eql(["  set"]);
            expect(outStub.getCall(7).args).to.eql(["  throw"]);
            expect(outStub.getCall(8).args).to.eql(["  unset"]);
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

    describe("set", () => {
        it("should store specified value", async () => {
            await executor.execCommand(context, 'set foo "bar baz"', true);
            expect(outStub.callCount).to.equal(0);
            expect(errorStub.callCount).to.equal(0);
            expect(context.vars["foo"]).to.equal("bar baz");
        })

        it("should list set variables", async () => {
            context.vars["b"] = "foo";
            context.vars["a"] = 1;
            await executor.execCommand(context, "set", true);
            expect(outStub.callCount).to.equal(2);
            expect(errorStub.callCount).to.equal(0);
            expect(outStub.getCall(0).args).to.eql(["a=1"]);
            expect(outStub.getCall(1).args).to.eql(["b=foo"]);
        })

        it("should not list anything if there are no variables set", async () => {
            await executor.execCommand(context, "set", true);
            expect(outStub.callCount).to.equal(0);
            expect(errorStub.callCount).to.equal(0);
        })

        it("should raise error if no value provided for variable", async () => {
            await expect(executor.execCommand(context, 'set foo', true)).to.be.eventually.rejectedWith("No value provided for 'foo'");
        })

        it("should be helpful", async () => {
            await executor.execCommand(context, "help set", true);
            expect(outStub.callCount).to.equal(1);
            expect(errorStub.callCount).to.equal(0);
            expect(outStub.getCall(0).args).to.eql(["Sets a script variable or lists all currently set variables\n  Usage: set [VARIABLE VALUE]"]);
        })
    })

    describe("unset", () => {
        it("should clear specified value", async () => {
            context.vars["foo"] = "bar";
            await executor.execCommand(context, "unset foo", true);
            expect(outStub.callCount).to.equal(0);
            expect(errorStub.callCount).to.equal(0);
            expect("foo" in context.vars).to.be.false;
        })

        it("should raise an error if the value isn't set", async () => {
            await expect(executor.execCommand(context, 'unset foo', true)).to.be.eventually.rejectedWith("'foo' is not set");
        })

        it("should be helpful", async () => {
            await executor.execCommand(context, "help unset", true);
            expect(outStub.callCount).to.equal(1);
            expect(errorStub.callCount).to.equal(0);
            expect(outStub.getCall(0).args).to.eql(["Clear a script variable\n  Usage: set VARIABLE"]);
        })
    })

    describe("Variable Resolution", () => {
        it("should resolve variables from the command context", async () => {
            context.vars["foo"] = "Hello World";
            executor.registerCommands(TEST_COMMANDS);
            await executor.execCommand(context, "out Test $foo !", true);
            expect(outStub.callCount).to.equal(3);
            expect(errorStub.callCount).to.equal(0);
            expect(outStub.getCall(0).args).to.eql(["Test"]);
            expect(outStub.getCall(1).args).to.eql(["Hello World"]);
            expect(outStub.getCall(2).args).to.eql(["!"]);
        })

        it("should raise error if variable not set", async () => {
            executor.registerCommands(TEST_COMMANDS);
            await expect(executor.execCommand(context, "out Test $foo !")).to.be.eventually.rejectedWith("Variable 'foo' not set");
            expect(outStub.callCount).to.equal(0);
            expect(errorStub.callCount).to.equal(0);
        })

        it("should raise error if variable not specified", async () => {
            executor.registerCommands(TEST_COMMANDS);
            await expect(executor.execCommand(context, "out Test $ !")).to.be.eventually.rejectedWith("Variable not specified");
            expect(outStub.callCount).to.equal(0);
            expect(errorStub.callCount).to.equal(0);
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