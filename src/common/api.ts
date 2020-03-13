export interface Loco {
    id?: number;
    address: number;
    name: string;
    discrete: boolean;
    speeds?: number[];
    maxSpeed?: number;
    cvs?: {[key: string]: number};
}
