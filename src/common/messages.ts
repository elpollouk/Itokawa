export enum RequestType {
    LifeCycle = 1,
    LocoSpeed = 2
}

export interface CommandRequest {
    requestTime?: string
    type: RequestType,
}

export interface LocoSpeedRequest extends CommandRequest {
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

export interface LifeCycleRequest extends CommandRequest {
    action: LifeCycleAction
}

export interface CommandResponse {
    lastMessage: boolean,
    data?: any,
    error?: string,
    responseTime?: string
}

export interface LifeCyclePingResponse extends CommandResponse {
    gitrev: string,
    commandStation: string,
    commandStationState: number,
    publicUrl: string
}
