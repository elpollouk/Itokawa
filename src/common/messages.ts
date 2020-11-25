export enum RequestType {
    LifeCycle = 1,
    LocoSpeed = 2,
    LocoFunction = 3,
    EmergencyStop = 4,
    LocoSpeedRefresh = 5,
    LocoFunctionRefresh = 6,
    LocoCvRead = 7,
    LocoCvWrite = 8,
    CommandResponse = 1000,
}

export interface TransportMessage {
    tag: string,
    requestTime: string,
    type: RequestType,
    data?: any
}

export interface LocoSpeedRequest {
    locoId: number,
    speed: number,
    reverse: boolean
}

export interface LocoSpeedRefreshRequest {
    locoId?: number
}

export enum FunctionAction {
    Trigger = 0,
    LatchOn = 1,
    LatchOff = 2
}

export interface LocoFunctionRequest {
    locoId: number,
    function: number,
    action: FunctionAction
}

export interface LocoFunctionRefreshRequest {
    locoId: number
}

export enum LifeCycleAction {
    ping = 0,
    shutdown = 1,
    restart = 2,
    update =3,
    updateOS = 4,
}

export interface LifeCycleRequest {
    action: LifeCycleAction
}

export interface LocoCvReadRequest {
    cvs: number[]
}

export interface CvValuePair {
    cv: number,
    value: number
}

export interface LocoCvWriteRequest {
    cvs: CvValuePair[]
}

export interface CommandResponse {
    lastMessage: boolean,
    data?: any,
    error?: string
}

export interface LifeCyclePingResponse extends CommandResponse {
    packageVersion: string,
    gitrev: string,
    commandStation: string,
    commandStationState: number,
    publicUrl: string
}

let _nextTagNumber: number = 1;

export function generateMessageTag(): string {
    if (typeof(process) == "object"){
        return `server:${_nextTagNumber++}`;
    }
    else {
        return `client:${_nextTagNumber++}`;
    }
}