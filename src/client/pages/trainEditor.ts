import { Page, IPageConstructor, Navigator as nav } from "./page";
import { Client } from "../client";
import { ApiClient } from "../apiClient";
import { Loco } from "../../common/api";
import { createElement } from "../utils/dom";
import * as prompt from "../controls/promptControl";

export interface TrainEditParams {
    id?: number
}

export class TrainEditPage extends Page {
    path: string = TrainEditConstructor.path;
    content: HTMLElement;

    private readonly _id: number;
    private readonly _api: ApiClient;

    private _nameElement: HTMLInputElement;
    private _addressElement: HTMLInputElement;
    private _slowElement: HTMLInputElement;
    private _mediumElement: HTMLInputElement;
    private _fastElement: HTMLInputElement;
  
    constructor (params: TrainEditParams) {
        super();
        params = params || {};
        this._id = params.id ? params.id : 0;
        this._api = Client.instance.api;
        this.content = this._buildUi();
    }

    private _buildUi(): HTMLElement {
        const container = document.createElement("div");
        container.className = "trainEditor container";
        createElement(container, "div", "title").innerText = "Edit Train";
        const editor = createElement(container, "div", "pageContent");
        
        // Human readable name
        let div = createElement(editor, "div", "setting");
        createElement(div, "div", "label").innerText = "Name";
        this._nameElement = createElement(div, "input");
        this._nameElement.type = "text";

        // Loco Address
        div = createElement(editor, "div", "setting");
        createElement(div, "div", "label").innerText = "Address";
        this._addressElement = createElement(div, "input");
        this._addressElement.type = "number";
        this._addressElement.min = "1";
        this._addressElement.max = "9999";

        // Speed settings
        div = createElement(editor, "div", "setting speed");
        createElement(div, "div", "label").innerText = "Speed settings";
        div = createElement(div, "div");

        const speedInput = () => {
            const el = createElement<HTMLInputElement>(div, "input");
            el.type = "number";
            el.min = "1";
            el.max = "127";
            return el;
        }
        this._slowElement = speedInput();
        this._mediumElement = speedInput();
        this._fastElement = speedInput();

        // Buttons
        const buttons = createElement(editor, "div", "buttons");
        let button = createElement(buttons, "button");
        button.innerText = "Save";
        button.onclick = () => this._save();
        button = createElement(buttons, "button");
        button.innerText = "Cancel";
        button.onclick = () => nav.back();

        return container;
    }

    onEnter() {
        /*this._api.getLocos().then((locos) => {
            this._trains.innerHTML = "";

            const addTrain = (loco: Loco) => {
                const title = createElement(this._trains, "div", "train");
                title.innerText = `${loco.address} - ${loco.name}`;
            };

            for (const loco of locos.locos) 
                addTrain(loco);
        });*/
    }

    _save() {
        prompt.confirm("Are you sure you want to save this train?", () => {
            this._api.addLoco(
                this._nameElement.value,
                parseInt(this._addressElement.value), [
                    parseInt(this._slowElement.value),
                    parseInt(this._mediumElement.value),
                    parseInt(this._fastElement.value)
                ]
            ).then(() => {
                nav.back();
            });
        });
    }
}

export const TrainEditConstructor: IPageConstructor = {
    path: "trainEdit",
    create: (params) => new TrainEditPage(params)
}