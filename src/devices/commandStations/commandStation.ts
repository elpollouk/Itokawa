export interface ICommandStation extends NodeJS.EventEmitter {
    version: string;

    init(): Promise<void>;
    close(): Promise<void>;
    setLocomotiveSpeed(locomotiveId: number, speed: number, reverse?:boolean): Promise<void>;
}