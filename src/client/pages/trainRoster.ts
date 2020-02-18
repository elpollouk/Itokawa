import { Page, IPageConstructor, Navigator as nav } from "./page";
import * as prompt from "../controls/promptControl";
import { Client } from "../client";
import { ApiClient } from "../apiClient";
import { Loco } from "../../common/api";
import { createElement } from "../utils/dom";
import { TrainEditConstructor } from "./trainEditor";

function pad(address: number) {
    const addr = `${address}`;
    return "0000".substr(addr.length) + addr;
}

export class TrainRosterPage extends Page {
    path: string = TrainRosterConstructor.path;
    content: HTMLElement;
    
    private _trains: HTMLElement;
    private readonly _api: ApiClient;

    
    constructor () {
        super();
        this._api = Client.instance.api;
        this.content = this._buildUi();
    }

    private _buildUi(): HTMLElement {
        const container = document.createElement("div");
        container.className = "trainRoster container";

        createElement(container, "div", "title").innerText = "Manage Trains";
        this._trains = createElement(container, "div", "trains pageContent");
        const buttons = createElement(container, "div", "buttons");

        let button = createElement(buttons, "button");
        button.innerText = "New...";
        button.onclick = () => nav.open(TrainEditConstructor.path);

        return container;
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

            for (const loco of locos.locos) 
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