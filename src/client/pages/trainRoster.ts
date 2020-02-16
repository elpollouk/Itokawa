import { Page, IPageConstructor } from "./page";
import { Client } from "../client";
import { ApiClient } from "../apiClient";
import { Loco } from "../../common/api";
import { createElement } from "../utils/dom";
import { create } from "qrcode";

export class TrainRosterPage extends Page {
    path: string = TrainRosterConstructor.path;
    content: HTMLElement;
    private readonly _api: ApiClient;

    _trains: HTMLElement;
    
    constructor () {
        super();
        this._api = Client.instance.api;
        this.content = this._buildUi();

        this._getTrains();
    }

    private _buildUi(): HTMLElement {
        const container = document.createElement("div");
        container.className = "trainRoster container";

        createElement(container, "div", "title").innerText = "Manage Trains";
        this._trains = createElement(container, "div", "trains");
        const buttons = createElement(container, "div", "buttons");

        let button = createElement(buttons, "button");
        button.innerText = "New...";

        return container;
    }

    private _getTrains() {
        this._api.getLocos().then((locos) => {
            this._trains.innerHTML = "";

            const addTrain = (loco: Loco) => {
                const title = createElement(this._trains, "div", "train");
                title.innerText = `${loco.address} - ${loco.name}`;
            };

            for (const loco of locos.locos) 
                addTrain(loco);
        });
    }
}

export const TrainRosterConstructor: IPageConstructor = {
    path: "trains",
    create: () => new TrainRosterPage()
}