export interface ICommandStation extends NodeJS.EventEmitter {
    // Don't forget to add the following to your command station class
    // static readonly DEVICE_ID = "...";

    version: string;

    init(): Promise<void>;
    close(): Promise<void>;
    setLocomotiveSpeed(locomotiveId: number, speed: number, reverse?:boolean): Promise<void>;
}