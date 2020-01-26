import { EventEmitter } from "events";
import { ICommandStation, ICommandBatch, CommandStationState } from "./commandStation"

export class MockCommandStation extends EventEmitter implements ICommandStation {
    static readonly deviceId = "Mock Command Station";
    get deviceId() { return MockCommandStation.deviceId; }

    constructor(public readonly path: string) {
        super();
    }

    get version(): string {
        return `${MockCommandStation.deviceId} 1.0`;
    }

    get state(): CommandStationState {
        return CommandStationState.UNINITIALISED;
    }
    
    init(): Promise<void> {
        return Promise.resolve();
    }
    close(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    beginCommandBatch(): Promise<ICommandBatch> {
        throw new Error("Method not implemented.");
    }
};