import { Page, IPageConstructor, Navigator as nav } from "./page";
import * as prompt from "../controls/promptControl";
import { IApiClient, client } from "../client";
import { Loco } from "../../common/api";
import { createElement, parseHtml, getById } from "../utils/dom";
import { TrainEditConstructor } from "./trainEditor";
const html = require("./trainRoster.html");

function pad(address: number) {
    const addr = `${address}`;
    return "0000".substr(addr.length) + addr;
}

export class TrainRosterPage extends Page {
    path: string = TrainRosterConstructor.path;
    content: HTMLElement;
    
    private _trains: HTMLElement;
    private readonly _api: IApiClient;

    
    constructor () {
        super();
        this._api = client.api;
        this.content = this._buildUi();
    }

    private _buildUi(): HTMLElement {
        const page = parseHtml(html);

        this._trains = getById(page, "trains");
        getById(page, "new").onclick = () => nav.open(TrainEditConstructor.path);

        return page;
    }

    onEnter() {
        this._refreshTrains();
    }

    private _refreshTrains(): Promise<void> {
        return this._api.getLocos().then((locos) => {
            this._trains.innerHTML = "";

            const addTrain = (loco: Loco) => {
                const title = createElement(this._trains, "div", "train");
                title.innerText = `${pad(loco.address)} - ${loco.name}`;
                title.onclick = (ev) => nav.open(TrainEditConstructor.path, { id: loco.id });
            };

            for (const loco of locos) 
                addTrain(loco);
        }).catch((err) => {
            console.error(err);
            prompt.error("Failed to load train list.");
        });
    }
}

export const TrainRosterConstructor: IPageConstructor = {
    path: "trains",
    create: () => new TrainRosterPage()
}