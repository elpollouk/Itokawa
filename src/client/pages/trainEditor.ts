import { Page, IPageConstructor, Navigator as nav } from "./page";
import { Client } from "../client";
import { ApiClient } from "../apiClient";
import { parseHtml, getById, vaildateIntInput, vaildateNotEmptyInput } from "../utils/dom";
import * as prompt from "../controls/promptControl";
import { firstCharLowerCase } from "xml2js/lib/processors";
const content = require("./trainEditor.html");

export interface TrainEditParams {
    id?: number
}

export class TrainEditPage extends Page {
    path: string = TrainEditConstructor.path;
    content: HTMLElement;

    private _id: number;
    private readonly _api: ApiClient;

    private _nameElement: HTMLInputElement;
    private _addressElement: HTMLInputElement;
    private _discreteElement: HTMLInputElement;
    private _maxSpeedEelement: HTMLInputElement;
    private _slowElement: HTMLInputElement;
    private _mediumElement: HTMLInputElement;
    private _fastElement: HTMLInputElement;
    private _deleteButton: HTMLButtonElement;
  
    constructor (params: TrainEditParams) {
        super();
        params = params || {};
        this._id = params.id ? params.id : 0;
        this._api = Client.instance.api;
        this.content = this._buildUi();
    }

    private _buildUi(): HTMLElement {
        const page = parseHtml(content);

        this._nameElement = getById(page, "name");
        this._addressElement = getById(page, "address");
        this._maxSpeedEelement = getById(page, "maxSpeed");
        this._slowElement = getById(page, "slow");
        this._mediumElement = getById(page, "medium");
        this._fastElement = getById(page, "fast");
        this._deleteButton = getById(page, "delete");
        this._deleteButton.onclick = () => this._delete();

        this._discreteElement = getById<HTMLInputElement>(page, "discrete");
        this._discreteElement.onchange = () => {
            if (this._discreteElement.checked) {
                page.classList.add("discrete");
            }
            else {
                page.classList.remove("discrete");
            }
        }

        getById(page, "save").onclick = () => this._save();
        getById(page, "cancel").onclick = () => nav.back();

        return page;
    }

    onEnter() {
        if (this._id) this._api.getLoco(this._id).then((loco) => {
            this._nameElement.value = loco.name;
            this._addressElement.value = `${loco.address}`;
            if (loco.discrete) {
                this._slowElement.value = `${loco.speeds[0]}`;
                this._mediumElement.value = `${loco.speeds[1]}`;
                this._fastElement.value = `${loco.speeds[2]}`;
                this._discreteElement.checked = true;
                this._discreteElement.onchange(null);
            }
            else {
                this._maxSpeedEelement.value = `${loco.maxSpeed}`;
            }
            this._deleteButton.style.visibility = "";
        }).catch((err) => {
            console.error(err);
            prompt.error("Failed to load train details.");
        })
    }

    _delete() {
        prompt.confirm("Are you sure you want to delete this train?", async () => {
            try {
                await this._api.deleteLoco(this._id);
                nav.back();
            }
            catch (err) {
                prompt.error(`Failed to delete train:\n${err.message}`);
            }
        });
    }

    _validate(): boolean {
        if (!vaildateNotEmptyInput(this._nameElement, "Name must be set.")) return false;
        if (!vaildateIntInput(this._addressElement, 1, 9999, "Address must be in the range 1-9999.")) return false;
        if (this._discreteElement.checked) {
            if (!vaildateIntInput(this._slowElement, 1, 127, "Slow speed must be in the range 1-127.")) return false;
            if (!vaildateIntInput(this._mediumElement, 1, 127, "Medium speed must be in the range 1-127.")) return false;
            if (!vaildateIntInput(this._fastElement, 1, 127, "Fast speed must be in the range 1-127.")) return false;
        }
        else {
            if (!vaildateIntInput(this._maxSpeedEelement, 1, 127, "Max speed must be in the range 1-127")) return false;
        }

        return true;
    }

    _save() {
        // TODO - Add protections against overlapped actions
        if (!this._validate()) return;

        prompt.confirm("Are you sure you want to save this train?", () => {
            const name = this._nameElement.value;
            const address = parseInt(this._addressElement.value);
            let speed: number[] | number;
            if (this._discreteElement.checked) {
                speed = [
                    parseInt(this._slowElement.value),
                    parseInt(this._mediumElement.value),
                    parseInt(this._fastElement.value)
                ];
            }
            else {
                speed = parseInt(this._maxSpeedEelement.value);
            }


            let promise: Promise<any>;
            if (this._id) {
                promise = this._api.updateLoco(this._id, name, address, speed);
            }
            else {
                promise = this._api.addLoco(name, address, speed).then((loco) => {
                    this._id = loco.id;
                    nav.replaceParams({
                        id: loco.id
                    });
                });
            }

            promise.then(() => {
                nav.back();
            }).catch((err) => {
                console.error(err);
                prompt.error("Failed to save train details.");
            });
        });
    }
}

export const TrainEditConstructor: IPageConstructor = {
    path: "trainEdit",
    create: (params) => new TrainEditPage(params)
}