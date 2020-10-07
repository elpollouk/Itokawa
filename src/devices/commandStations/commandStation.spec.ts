import { expect, use } from "chai";
use(require("chai-as-promised"));
import { stub, createStubInstance } from "sinon";
import "mocha";
import { CommandStationError, CommandStationBase, CommandStationState } from "./commandStation";
import { Logger } from "../../utils/logger";
import { nextTick } from "../../utils/promiseUtils";

describe("CommandSation Error", () => {
    it("should extend Error correctly", () => {
        const err = new CommandStationError("Test error");

        expect(err).to.be.an.instanceOf(Error);
        expect(err.name).to.equal("CommandStationError");
        expect(err.message).to.equal("Test error");
    })
})

describe("Command Station Base", () => {

    class TestCommmandStation extends CommandStationBase {
        version: string = "0.0.0";
        deviceId: string = "Test";

        constructor(log: Logger = null) {
            super(log);
            this._log.info("Testing");
        }

        close(): Promise<void> {
            throw new Error("Method not implemented.");
        }

        beginCommandBatch(): Promise<import("./commandStation").ICommandBatch> {
            throw new Error("Method not implemented.");
        }

        setState(state: CommandStationState) {
            this._setState(state);
        }

        ensureState(state: CommandStationState) {
            this._ensureState(state);
        }

        ensureIdle() {
            this._ensureIdle();
        }

        setBusy() {
            this._setBusy();
        }
    
        setIdle() {
            this._setIdle();
        }

        setError(error: Error) {
            this._setError(error);
        }
    
        untilState(state: CommandStationState): Promise<void> {
            return this._untilState(state);
        }

        untilIdle(): Promise<void> {
            return this._untilIdle();
        }

        requestStateTransition(from: CommandStationState, to: CommandStationState): Promise<void> {
            return this._requestStateTransition(from, to);
        }
    }

    describe("Constructor", () => {
        it ("should construct without a logger", () => {
            const cs = new TestCommmandStation();
            expect(cs.deviceId).to.equal("Test");
            expect(cs.version).to.equal("0.0.0");
            expect(cs.state).to.equal(CommandStationState.UNINITIALISED);
        })

        it ("should construct with a logger", () => {
            const logStub = createStubInstance(Logger);
            const cs = new TestCommmandStation(logStub);
            expect(logStub.info.lastCall.args).to.eql(["Testing"]);
        })
    })

    describe("Write Raw", () => {
        it("should reject raw writes", async () => {
            const cs = new TestCommmandStation();
            await expect(cs.writeRaw([])).to.be.eventually.rejectedWith("Raw writes are not unsupported");
        })
    })

    describe("State", () => {
        it ("should fire state changed events", () => {
            const cs = new TestCommmandStation();
            const onState = stub();
            cs.on("state", onState);
            cs.setState(CommandStationState.IDLE);

            expect(cs.state).to.equal(CommandStationState.IDLE);
            expect(onState.lastCall.args).to.eql([CommandStationState.IDLE, CommandStationState.UNINITIALISED]);
        })

        it ("should not fire state changed events multiple times for same event", () => {
            const cs = new TestCommmandStation();
            const onState = stub();
            cs.on("state", onState);
            cs.setState(CommandStationState.IDLE);
            cs.setState(CommandStationState.IDLE);

            expect(onState.callCount).to.equal(1);
            expect(onState.lastCall.args).to.eql([CommandStationState.IDLE, CommandStationState.UNINITIALISED]);
        })

        it ("should be possible to await until a specific state", async () => {
            const cs = new TestCommmandStation();
            const then = stub();
            const error = stub();
            cs.untilState(CommandStationState.INITIALISING).then(then, error);
            await nextTick();

            expect(then.callCount).to.equal(0);
            expect(error.callCount).to.equal(0);

            cs.setState(CommandStationState.IDLE);
            await nextTick();

            expect(then.callCount).to.equal(0);
            expect(error.callCount).to.equal(0);

            cs.setState(CommandStationState.INITIALISING);
            await nextTick();

            expect(then.callCount).to.equal(1);
            expect(error.callCount).to.equal(0);
        })

        it ("should reject awaiting promise if error occurs while awaiting a state", async () => {
            const cs = new TestCommmandStation();
            const promise = cs.untilState(CommandStationState.IDLE);
            await nextTick();

            cs.setState(CommandStationState.ERROR);

            await expect(promise).to.be.eventually.rejectedWith("Command station is in ERROR state");
        })

        it ("should reject with custom error awaiting promise if error occurs while awaiting a state", async () => {
            const cs = new TestCommmandStation();
            const promise = cs.untilState(CommandStationState.IDLE);
            await nextTick();

            cs.setError(new Error("Testing"))

            await expect(promise).to.be.eventually.rejectedWith("Testing");
        })

        it ("should reject istantly if already in error state bust asked to await another state", async () => {
            const cs = new TestCommmandStation();
            cs.setState(CommandStationState.ERROR);

            await expect(cs.untilState(CommandStationState.IDLE)).to.be.eventually.rejectedWith("Command station is in ERROR state");
        })

        it ("should reject with custom error istantly if already in error state bust asked to await another state", async () => {
            const cs = new TestCommmandStation();
            cs.setError(new Error("Custom Error"));

            await expect(cs.untilState(CommandStationState.IDLE)).to.be.eventually.rejectedWith("Custom Error");
        })

        it ("should be safe to await the current state", async () => {
            const cs = new TestCommmandStation();
            const then = stub();
            const error = stub();
            cs.setState(CommandStationState.IDLE);
            cs.untilState(CommandStationState.IDLE).then(then, error);
            await nextTick();

            expect(then.callCount).to.equal(1);
            expect(error.callCount).to.equal(0);
        })

        it ("should be possible to await until IDLE state", async () => {
            const cs = new TestCommmandStation();
            const then = stub();
            const error = stub();
            cs.untilIdle().then(then, error);
            cs.setState(CommandStationState.IDLE);
            await nextTick();

            expect(then.callCount).to.equal(1);
            expect(error.callCount).to.equal(0);
        })

        it ("should be possible to request a specific state transition", async () => {
            const cs = new TestCommmandStation();
            const then = stub();
            const error = stub();

            cs.requestStateTransition(
                CommandStationState.INITIALISING,
                CommandStationState.IDLE
            ).then(then, error);
            await nextTick();

            expect(cs.state).to.equal(CommandStationState.UNINITIALISED);
            cs.setState(CommandStationState.INITIALISING);
            await nextTick();

            expect(cs.state).to.equal(CommandStationState.IDLE);
            expect(then.callCount).to.equal(1);
            expect(error.callCount).to.equal(0);
        })

        it ("should be possible to request a transition from the current state", async () => {
            const cs = new TestCommmandStation();
            cs.setState(CommandStationState.IDLE);
            const then = stub();
            const error = stub();

            cs.requestStateTransition(
                CommandStationState.IDLE,
                CommandStationState.BUSY
            ).then(then, error);

            expect(cs.state).to.equal(CommandStationState.BUSY);
            await nextTick();
            expect(then.callCount).to.equal(1);
            expect(error.callCount).to.equal(0);
        })
    })

    describe("State Validate", () => {
        it ("should not raise exception if in correct state", () => {
            const cs = new TestCommmandStation();
            cs.setState(CommandStationState.INITIALISING);
            cs.ensureState(CommandStationState.INITIALISING);
        })

        it ("should raise exception if in wrong state", () => {
            const cs = new TestCommmandStation();
            expect(() => cs.ensureState(CommandStationState.INITIALISING)).to.throw("Test is in wrong state for requested operation, state=UNINITIALISED, expectedState=INITIALISING");
        })

        it ("should explicitly ensure idel state", () => {
            const cs = new TestCommmandStation();
            cs.setState(CommandStationState.IDLE);
            cs.ensureIdle();
        })

        it ("should raise exception if in wrong state", () => {
            const cs = new TestCommmandStation();
            cs.setState(CommandStationState.BUSY);
            expect(() => cs.ensureIdle()).to.throw("Test is in wrong state for requested operation, state=BUSY, expectedState=IDLE");
        })

        it ("should have a short cut for setting to IDLE", () => {
            const cs = new TestCommmandStation();
            cs.setIdle();
            expect(cs.state).to.equal(CommandStationState.IDLE);
        })

        it ("should have a short cut for setting to BUSY", () => {
            const cs = new TestCommmandStation();
            cs.setBusy();
            expect(cs.state).to.equal(CommandStationState.BUSY);
        })

        it ("should have short cut for querying IDLE", () => {
            const cs = new TestCommmandStation();
            expect(cs.isIdle).to.be.false;
            cs.setState(CommandStationState.IDLE);
            expect(cs.isIdle).to.be.true;
        })

        it ("should have short cut for querying BUSY", () => {
            const cs = new TestCommmandStation();
            expect(cs.isBusy).to.be.false;
            cs.setState(CommandStationState.BUSY);
            expect(cs.isBusy).to.be.true;
        })
    })

    describe("readLocoCv", () => {
        it("should reject with unsupported error", async () => {
            const cs = new TestCommmandStation();
            await expect(cs.readLocoCv(1)).to.eventually.be.rejectedWith("CV reading is not supported");
        })
    })

    describe("writeLocoCv", () => {
        it("should reject with unsupported error", async () => {
            const cs = new TestCommmandStation();
            await expect(cs.writeLocoCv(1, 10)).to.eventually.be.rejectedWith("CV writing is not supported");
        })
    })
})