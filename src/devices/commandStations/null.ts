import { Logger } from "../../utils/logger";
import { CommandStationBase, ICommandBatch, CommandStationState, ICommandStation } from "./commandStation";
import { toHumanHex } from "../../utils/hex";
import { parseConnectionString, parseFloatStrict } from "../../utils/parsers";
import { timeout } from "../../utils/promiseUtils";
import { ensureCvNumber, ensureByte } from "./nmraUtils";

const log = new Logger("NullCommandStation");

export class NullCommandStation extends CommandStationBase {
    static readonly deviceId = "NullCommandStation";
    readonly deviceId = NullCommandStation.deviceId;
    version: string = "1.0.0";
    private readonly _execTime: number;
    private readonly _cvValues = {
        1: 3,
        3: 5,
        4: 5,
        7: 100,
        8: 255,
        10: 128,
        29: 6
    };

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

    readLocoCv(cv: number): Promise<number> {
        try {
            ensureCvNumber(cv);
            return Promise.resolve(this._cvValues[cv] || 0);
        }
        catch (err) {
            return Promise.reject(err);
        }
    }

    writeLocoCv(cv: number, value: number): Promise<void> {
        try {
            ensureCvNumber(cv);
            ensureByte(value);
            if (cv === 7 || cv === 8)
                throw new Error("Attempted to write to readonly CV");

            this._cvValues[cv] = value;
            return Promise.resolve();
        }
        catch(err) {
            return Promise.reject(err);
        }
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

    setLocomotiveFunction(locomotiveId: number, func: number, active: boolean): void {
        log.debug(() => `setLocomotiveFunction - locoId=${locomotiveId}, function=${func}, active=${active}`);
    }

    writeRaw(data: Buffer | number[]): void {
        log.debug(() => `writeRaw - bytes=${data.length}, data=${toHumanHex(data)}`);
    }
}