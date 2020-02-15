export interface Loco {
    id: number;
    address: number;
    name: string;
    speeds?: number[];
    maxSpeed?: number;
}

export interface Locos {
    locos: Loco[];
}