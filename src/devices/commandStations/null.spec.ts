import { expect } from "chai";
import "mocha";

import { CommandStationState } from "./commandStation"
import { NullCommandStation, NullCommandBatch } from "./null";

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
})