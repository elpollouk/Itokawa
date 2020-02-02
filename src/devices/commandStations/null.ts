import { Logger } from "../../utils/logger";
import { CommandStationBase, ICommandBatch, CommandStationState, ICommandStation } from "./commandStation";
import { toHumanHex } from "../../utils/hex";
import { parseConnectionString, parseFloatStrict } from "../../utils/parsers";
import { timeout } from "../../utils/promiseUtils";

const log = new Logger("NullCommandStation");

export class NullCommandStation extends CommandStationBase {
    static readonly deviceId = "Null";
    readonly deviceId = NullCommandStation.deviceId;
    version: string = "1.0.0";
    private readonly _execTime: number;

    static open(connectionString?: string): Promise<ICommandStation> {
        let cs = new NullCommandStation(connectionString);
        return Promise.resolve(cs);
    }

    constructor(connectionString?: string) {
        super(log);
        const config = parseConnectionString(connectionString, {
            execTime: parseFloatStrict
        });
        this._execTime = config.execTime || 0;
        this._setState(CommandStationState.IDLE);
    }

    close(): Promise<void> {
        this._setState(CommandStationState.UNINITIALISED);
        return Promise.resolve();
    }
    
    beginCommandBatch(): Promise<ICommandBatch> {
        log.debug("Beginning command batch...");
        return Promise.resolve(new NullCommandBatch(async () => {
            await this._requestIdleToBusy();
            await timeout(this._execTime);
            this._setIdle();
        }));
    }

    writeRaw(data: Buffer | number[]): Promise<void> {
        log.debug(() => `writeRaw to command station, size=${data.length} bytes=${toHumanHex(data)}`);
        return Promise.resolve();
    }
}

export class NullCommandBatch implements ICommandBatch {
    constructor(private readonly _commit: ()=>Promise<void>) {

    }

    async commit()
    {
        await this._commit();
        log.debug("Committed command batch");
    }
    
    setLocomotiveSpeed(locomotiveId: number, speed: number, reverse?: boolean): void {
        log.debug(() => `setLocomotiveSpeed - locoId=${locomotiveId}, speed=${speed}, reverse=${!!reverse}`);
    }

    writeRaw(data: Buffer | number[]): void {
        log.debug(() => `writeRaw - bytes=${data.length}, data=${toHumanHex(data)}`);
    }
}