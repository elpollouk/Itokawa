import { Page, IPageConstructor, Navigator as nav } from "./page";
import { IApiClient, client } from "../client";
import { parseHtml, getById, vaildateIntInput, vaildateNotEmptyInput } from "../utils/dom";
import * as prompt from "../controls/promptControl";
import { CvEditorConstructor, CvEditorPage } from "./cvEditor";
import { CvMap } from "../../common/api";
import { FunctionSetuprConstructor } from "./functionSetup";
const content = require("./trainEditor.html");

export interface TrainEditParams {
    id?: number
}

export class TrainEditPage extends Page {
    path: string = TrainEditConstructor.path;
    content: HTMLElement;

    private _id: number;
    private readonly _api: IApiClient;
    private _cvs: CvMap = {};

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
        this._api = client.api;
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

        getById(page, "functionSetup").onclick = () => this._functionSetup();
        getById(page, "editCVs").onclick = () => this._editCvs();
        getById(page, "save").onclick = () => this._save(true);
        getById(page, "cancel").onclick = () => nav.back();

        return page;
    }

    onEnter(previousPage: Page) {
        super.onEnter(previousPage);
        if (this._id) this._api.getLoco(this._id).then((loco) => {
            this._nameElement.value = loco.name;
            this._addressElement.value = `${loco.address}`;
            this._cvs = loco.cvs || {};
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
            this._deleteButton.style.display = "";

            if (previousPage && previousPage instanceof CvEditorPage) {
                if (this._haveCVsChanged(previousPage.cvs)) {
                    this._cvs = previousPage.cvs;
                    this._save(false);
                }
            }
        }).catch((err) => {
            console.error(err);
            prompt.error("Failed to load train details.");
        })
    }

    private _haveCVsChanged(newCVs: CvMap) {
        for (const key in newCVs) {
            if (this._cvs[key] !== newCVs[key])
                return true;
        }
        return false;
    }

    private _delete() {
        prompt.confirm("Are you sure you want to delete this train?").then(async (yes) => {
            if (!yes) return;
            try {
                await this._api.deleteLoco(this._id);
                nav.back();
            }
            catch (err) {
                prompt.error(`Failed to delete train:\n${err.message}`);
            }
        });
    }

    private _validate(): boolean {
        if (!vaildateNotEmptyInput(this._nameElement, "Name must be set.")) return false;
        if (!vaildateIntInput(this._addressElement, "Address must be in the range 1-9999.")) return false;
        if (this._discreteElement.checked) {
            if (!vaildateIntInput(this._slowElement, "Slow speed must be in the range 1-127.")) return false;
            if (!vaildateIntInput(this._mediumElement, "Medium speed must be in the range 1-127.")) return false;
            if (!vaildateIntInput(this._fastElement, "Fast speed must be in the range 1-127.")) return false;
        }
        else {
            if (!vaildateIntInput(this._maxSpeedEelement, "Max speed must be in the range 1-127")) return false;
        }

        return true;
    }

    private _functionSetup() {
        nav.open(FunctionSetuprConstructor.path, {});
        return false;
    }

    private _editCvs() {
        nav.open(CvEditorConstructor.path, this._cvs);
        return false;
    }

    private _save(navBackOnSuccess: boolean) {
        // TODO - Add protections against overlapped actions
        if (!this._validate()) return;

        prompt.confirm("Are you sure you want to save this train?").then((yes) => {
            if (!yes) return;

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
                promise = this._api.updateLoco(this._id, name, address, speed, this._cvs);
            }
            else {
                promise = this._api.addLoco(name, address, speed, this._cvs).then((loco) => {
                    this._id = loco.id;
                    nav.replaceParams({
                        id: loco.id
                    });
                });
            }

            promise.then(() => {
                if (navBackOnSuccess)
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