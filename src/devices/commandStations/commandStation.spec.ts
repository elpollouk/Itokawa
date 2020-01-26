import { expect } from "chai";
import "mocha";
import { CommandStationError } from "./commandStation";

describe("CommandSationError", () => {
    it("should extend Error correctly", () => {
        const err = new CommandStationError("Test error");

        expect(err).to.be.an.instanceOf(Error);
        expect(err.name).to.equal("CommandStationError");
        expect(err.message).to.equal("Test error");
    });
});