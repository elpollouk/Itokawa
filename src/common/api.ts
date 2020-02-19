export interface Loco {
    id?: number;
    address: number;
    name: string;
    discrete: boolean;
    speeds?: number[];
    maxSpeed?: number;
}

export interface Locos {
    locos: Loco[];
}