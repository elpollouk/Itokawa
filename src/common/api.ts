export type CvMap = {[key: string]: number};

export interface Loco {
    id?: number;
    address: number;
    name: string;
    discrete: boolean;
    speeds?: number[];
    maxSpeed?: number;
    cvs?: CvMap;
}
