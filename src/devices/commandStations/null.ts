import { Logger } from "../../utils/logger";
import { CommandStationBase, ICommandBatch, CommandStationState, ICommandStation } from "./commandStation";

const log = new Logger("NullCommandStation");

export class NullCommandStation extends CommandStationBase {
    static readonly deviceId = "Null";
    readonly deviceId = NullCommandStation.deviceId;
    version: string = "1.0.0";

    static open(connectionString: string): Promise<ICommandStation> {
        let cs = new NullCommandStation();
        return Promise.resolve(cs);
    }

    constructor() {
        super(log);
        this._setState(CommandStationState.IDLE);
    }

    close(): Promise<void> {
        this._setState(CommandStationState.UNINITIALISED);
        return Promise.resolve();
    }
    
    beginCommandBatch(): Promise<ICommandBatch> {
        log.debug("Beginning command batch...");
        return Promise.resolve(new NullCommandBatch());
    }
}

export class NullCommandBatch implements ICommandBatch {
    commit(): Promise<void>
    {
        log.debug("Committed command batch");
        return Promise.resolve();
    }
    
    setLocomotiveSpeed(locomotiveId: number, speed: number, reverse?: boolean): void {
        log.debug(() => `setLocomotiveSpeed - locoId=${locomotiveId}, speed=${speed}, reverse=${!!reverse}`);
    }
}