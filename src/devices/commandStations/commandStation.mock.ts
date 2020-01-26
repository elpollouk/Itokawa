import { EventEmitter } from "events";
import { ICommandStation } from "./commandStation"

export class MockCommandStation extends EventEmitter implements ICommandStation {
    static readonly DEVICE_ID = "Mock Command Station";

    constructor(public readonly path: string) {
        super();
    }

    get version(): string {
        return `${MockCommandStation.DEVICE_ID} 1.0`;
    }
    
    init(): Promise<void> {
        return Promise.resolve();
    }
    close(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    commitCommands(): Promise<void> {
        throw new Error("Method not implemented.");
    }    
    setLocomotiveSpeed(locomotiveId: number, speed: number, reverse?: boolean): Promise<void> {
        throw new Error("Method not implemented.");
    }
};