import { expect } from "chai";
import "mocha";

import { CommandStationState } from "./commandStation"
import { NullCommandStation, NullCommandBatch } from "./null";
import { ensureCvNumber } from "./nmraUtils";

describe("Null Command Station", () => {
    it("should open without error", async () => {
        const cs = await NullCommandStation.open(null);
        expect(cs).to.not.be.null;
        expect(cs.deviceId).to.equal("NullCommandStation");
        expect(cs.version).to.equal("1.0.0");
        expect(cs.state).to.equal(CommandStationState.IDLE);
    })

    it("should close without error", async () => {
        const cs = await NullCommandStation.open(null);
        await cs.close();
        expect(cs.state).to.equal(CommandStationState.UNINITIALISED);
    })

    it("should begin a batch without error without error", async () => {
        const cs = await NullCommandStation.open(null);
        const batch = await cs.beginCommandBatch();
        expect(batch).to.be.instanceOf(NullCommandBatch);
    })

    it("should be possible to set loco speed forward without error", async () => {
        const cs = await NullCommandStation.open(null);
        const batch = await cs.beginCommandBatch();

        batch.setLocomotiveSpeed(123, 45);
    })

    it("should be possible to set loco speed reverse without error", async () => {
        const cs = await NullCommandStation.open(null);
        const batch = await cs.beginCommandBatch();

        batch.setLocomotiveSpeed(123, 45, true);
    })

    it("should be possible write a raw command", async () => {
        const cs = await NullCommandStation.open(null);
        const batch = await cs.beginCommandBatch();

        batch.writeRaw([0, 1, 2]);
    })

    it("should be possible to commit batch without error", async () => {
        const cs = await NullCommandStation.open(null);
        const batch = await cs.beginCommandBatch();

        await batch.commit();
    })

    it("should accept raw writes", async () => {
        const cs = await NullCommandStation.open();
        await cs.writeRaw([]);
    })

    describe("readLocoCv", () => {
        it("should initialise default CV values", async () => {
            const cs = await NullCommandStation.open();
            expect(await cs.readLocoCv(1)).to.equal(3);
            expect(await cs.readLocoCv(3)).to.equal(5);
            expect(await cs.readLocoCv(4)).to.equal(5);
            expect(await cs.readLocoCv(7)).to.equal(100);
            expect(await cs.readLocoCv(8)).to.equal(255);
            expect(await cs.readLocoCv(29)).to.equal(6);
        })

        it("should return 0 for unset CV value", async () => {
            const cs = await NullCommandStation.open();
            expect(await cs.readLocoCv(255)).to.equal(0);
        })

        it("should reject invalid CV number", async () => {
            const cs = await NullCommandStation.open();
            expect(cs.readLocoCv(0)).to.be.eventually.rejectedWith("CV 0 outside of valid range");
        })
    })

    describe("writeLocoCv", () => {
        it("should update existing CV value", async () => {
            const cs = await NullCommandStation.open();
            await cs.writeLocoCv(1, 10);
            expect(await cs.readLocoCv(1)).to.equal(10);
        })

        it("should update unset CV value", async () => {
            const cs = await NullCommandStation.open();
            await cs.writeLocoCv(255, 123);
            expect(await cs.readLocoCv(255)).to.equal(123);
        })

        it("should reject invalid CV number", async () => {
            const cs = await NullCommandStation.open();
            expect(cs.writeLocoCv(256, 1)).to.be.eventually.rejectedWith("CV 256 outside of valid range");
        })

        it("should reject invalid CV value", async () => {
            const cs = await NullCommandStation.open();
            expect(cs.writeLocoCv(1, -1)).to.be.eventually.rejectedWith("Byte(-1) outside of valid range");
        })

        it("should reject writing to CV 7", async () => {
            const cs = await NullCommandStation.open();
            expect(cs.writeLocoCv(7, 1)).to.be.eventually.rejectedWith("Attempted to write to readonly CV");
        })

        it("should reject writing to CV 8", async () => {
            const cs = await NullCommandStation.open();
            expect(cs.writeLocoCv(8, 1)).to.be.eventually.rejectedWith("Attempted to write to readonly CV");
        })
    })
})