export enum RequestType {
    LifeCycle = 1,
    LocoSpeed = 2
}

export interface CommandRequest {
    type: RequestType,
    requestTime?: string
}

export interface LocoSpeedRequest extends CommandRequest {
    locoId: number,
    speed: number,
    reverse: boolean
}

export enum LifeCycleAction {
    ping = 0,
    shutdown = 1
}

export interface LifeCycleRequest extends CommandRequest {
    action: LifeCycleAction
}

export interface CommandResponse {
    data?: any,
    error?: string,
    responseTime?: string
}

export interface LifeCyclePingResponse extends CommandResponse {
    gitrev: string,
    commandStation: string,
    commandStationState: number
}
