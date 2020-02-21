export enum RequestType {
    LifeCycle = 1,
    LocoSpeed = 2,
    EmergencyStop = 3,
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

export enum LifeCycleAction {
    ping = 0,
    shutdown = 1,
    restart = 2,
    update =3,
}

export interface LifeCycleRequest {
    action: LifeCycleAction
}

export interface CommandResponse {
    lastMessage: boolean,
    data?: any,
    error?: string
}

export interface LifeCyclePingResponse extends CommandResponse {
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