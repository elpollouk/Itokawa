import { EventEmitter } from "events";
import { ICommandStation, ICommandBatch, CommandStationState } from "./commandStation"

export class MockCommandStation extends EventEmitter implements ICommandStation {
    static readonly deviceId = "Mock Command Station";
    static open(connectionString: string): Promise<ICommandStation> {
        return Promise.resolve(new MockCommandStation());
    }

    get deviceId() { return MockCommandStation.deviceId; }

    constructor() {
        super();
    }

    get version(): string {
        return `${MockCommandStation.deviceId} 1.0`;
    }

    get state(): CommandStationState {
        return CommandStationState.UNINITIALISED;
    }
    
    close(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    
    beginCommandBatch(): Promise<ICommandBatch> {
        throw new Error("Method not implemented.");
    }
};