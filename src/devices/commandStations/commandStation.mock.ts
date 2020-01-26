import { EventEmitter } from "events";
import { ICommandStation } from "./commandStation"

export class MockCommandStation extends EventEmitter implements ICommandStation {
    static readonly deviceId = "Mock Command Station";
    get deviceId() { return MockCommandStation.deviceId; }

    constructor(public readonly path: string) {
        super();
    }

    get version(): string {
        return `${MockCommandStation.deviceId} 1.0`;
    }
    
    init(): Promise<void> {
        return Promise.resolve();
    }
    close(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    beginCommandBatch(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    commitCommandBatch(): Promise<void> {
        throw new Error("Method not implemented.");
    }    
    setLocomotiveSpeed(locomotiveId: number, speed: number, reverse?: boolean): Promise<void> {
        throw new Error("Method not implemented.");
    }
};