export enum FunctionMode {
    NotSet = 0,
    Trigger = 1,
    Latched = 2,
    Macro = 3
}

export interface FunctionConfig {
    name: string,
    mode: FunctionMode,
    exec: string
}

export type CvMap = {[key: string]: number};

export interface Loco {
    id?: number;
    address: number;
    name: string;
    discrete: boolean;
    speeds?: number[];
    maxSpeed?: number;
    functions?: FunctionConfig[],
    cvs?: CvMap;
}
