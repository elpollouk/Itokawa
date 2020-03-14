import * as api from "../../common/api";
import { IApiClient } from "../client";

// Mock API client so that we can publish a demo as a static web page
export class DemoApiClient implements IApiClient {
    private _locos: api.Loco[] = [];
    private _nextLocoId = 1;

    private _saveData() {
        window.sessionStorage.setItem("locos", JSON.stringify(this._locos));
        window.sessionStorage.setItem("nextLocoId", `${this._nextLocoId}`);
    }

    private _loadData() {
        if (window.sessionStorage.length !== 0) {
            this._locos = JSON.parse(window.sessionStorage.getItem("locos"));
            this._nextLocoId = parseInt(window.sessionStorage.getItem("nextLocoId"));
        }
    }

    constructor() {
        this._loadData();
    }

    getLocos(): Promise<api.Loco[]> {
        return Promise.resolve(this._locos);
    }

    addLoco(name: string, address: number, speed: number | number[], cvs: api.CvMap): Promise<api.Loco> {
        const loco: api.Loco = {
            id: this._nextLocoId++,
            name: name,
            address: address,
            discrete: Array.isArray(speed),
            cvs: cvs
        }

        if (Array.isArray(speed)) {
            loco.speeds = speed;
        }
        else {
            loco.maxSpeed = speed;
        }

        this._locos.push(loco);
        this._saveData();

        return Promise.resolve(loco);
    }

    getLoco(id: number): Promise<api.Loco> {
        for (const loco of this._locos) {
            if (loco.id === id) {
                return Promise.resolve(loco);
            }
        }

        return Promise.reject(new Error("Loco not found"));
    }

    deleteLoco(id: number): Promise<void> {
        for (let i = 0; i < this._locos.length; i++) {
            if (this._locos[i].id === id) {
                this._locos.splice(i, 1);
                break;
            }
        }
        this._saveData();

        return Promise.resolve();
    }

    updateLoco(id: number, name: string, address: number, speed: number | number[], cvs: api.CvMap): Promise<void> {
        for (const loco of this._locos) {
            if (loco.id === id) {
                loco.name = name;
                loco.address = address;
                loco.cvs = cvs;
                if (Array.isArray(speed)) {
                    loco.discrete = true;
                    loco.speeds = speed;
                }
                else {
                    loco.discrete = false;
                    loco.maxSpeed = speed;
                }
                this._saveData();
                return Promise.resolve();
            }
        }

        return Promise.reject(new Error("Loco not found"));
    }
}