export const VIEW_ONTRACK = "On Track";

export enum FunctionMode {
    NotSet = 0,
    Trigger = 1,
    Latched = 2,
    Monetary = 3,
    Macro = 4
}

export interface FunctionConfig {
    name: string,
    mode: FunctionMode,
    exec: string
}

export type CvMap = {[key: string]: number};

export interface EphemeralData {
    onTrack: boolean;
}

export interface Loco {
    id?: number;
    address: number;
    name: string;
    discrete: boolean;
    speeds?: number[];
    maxSpeed?: number;
    functions?: FunctionConfig[];
    cvs?: CvMap;

    _emphemeral?: EphemeralData;
}

export interface Config {
    client?: any;
    features?: string[]
}