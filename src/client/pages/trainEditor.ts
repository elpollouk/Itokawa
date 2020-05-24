import { Page, IPageConstructor, Navigator as nav } from "./page";
import { IApiClient, client } from "../client";
import { parseHtml, getById, vaildateIntInput, vaildateNotEmptyInput } from "../utils/dom";
import * as prompt from "../controls/promptControl";
import { CvEditorConstructor, CvEditorPage } from "./cvEditor";
import { CvMap, FunctionConfig } from "../../common/api";
import { FunctionSetupConstructor, FunctionSetupPage } from "./functionSetup";
const content = require("./trainEditor.html");

export interface TrainEditParams {
    id?: number,
    name?: string
    address?: number;
    speeds?: number[];
}

export class TrainEditPage extends Page {
    path: string = TrainEditConstructor.path;
    content: HTMLElement;

    private _params: TrainEditParams;
    private readonly _api: IApiClient;
    private _functions: FunctionConfig[] = [];
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
        this._params = params || {};
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
        getById(page, "cancel").onclick = () => this._cancel();

        return page;
    }

    onEnter(previousPage: Page) {
        super.onEnter(previousPage);
        this._loadDetails(previousPage).catch((err) => {
            console.error(err);
            prompt.error("Failed to load train details.");
        })
    }

    private async _loadDetails(previousPage: Page) {
        let name: string;
        let address: number;
        let speeds: number[] = [];

        if (this._params.id) {
            const loco = await this._api.getLoco(this._params.id);

            name = loco.name;
            address = loco.address;
            this._functions = loco.functions || [];
            this._cvs = loco.cvs || {};
            if (loco.discrete) {
                speeds = loco.speeds;
            }
            else {
                speeds = [loco.maxSpeed];
            }

            this._deleteButton.style.display = "";
        }

        // Get overrides from parameters passed to the page
        name = this._params.name ?? name;
        address = this._params.address ?? address;
        speeds = this._params.speeds ?? speeds;

        // Update the UI elemets with the values we'd found
        this._nameElement.value = name ?? "";
        if (address) this._addressElement.value = `${address}`;
        if (speeds.length === 3) {
            this._slowElement.value = `${speeds[0]}`;
            this._mediumElement.value = `${speeds[1]}`;
            this._fastElement.value = `${speeds[2]}`;
            this._discreteElement.checked = true;
            this._discreteElement.onchange(null);
        }
        else if (speeds.length !== 0) {
            this._maxSpeedEelement.value = `${speeds[0]}`;
        }

        // Get the latest CV and function values if returning from a sub setup page
        if (previousPage instanceof FunctionSetupPage) {
            if (this._haveFunctionsChanged(previousPage.functions)) {
                this._functions = previousPage.functions;
                this._save(false);
            }
        }
        else if (previousPage instanceof CvEditorPage) {
            if (this._haveCVsChanged(previousPage.cvs)) {
                this._cvs = previousPage.cvs;
                this._save(false);
            }
        }
    }

    private _updatePageParams() {
        const params: TrainEditParams = { id: this._params.id };

        // Determine if UI elements contain valid values before we update each paramter
        if (this._nameElement.value) params.name = this._nameElement.value;
        if (this._addressElement.value) params.address = parseInt(this._addressElement.value);
        // Pack the speed values. This is different to the database format.
        if (this._discreteElement.checked) {
            const min = parseInt(this._slowElement.value);
            const med = parseInt(this._mediumElement.value);
            const max = parseInt(this._fastElement.value);
            if (!isNaN(min) && !isNaN(med) && !isNaN(max)) params.speeds = [min, med, max];
        }
        else {
            const value = parseInt(this._maxSpeedEelement.value);
            if (!isNaN(value)) params.speeds = [value];
        }

        this._params = params;
        nav.replaceParams(params);
    }

    private _haveFunctionsChanged(newFunctions: FunctionConfig[]) {
        if (this._functions.length != newFunctions.length) return true;
        for (let i = 0; i < newFunctions.length; i++) {
            if (this._functions[i].name != newFunctions[i].name) return true;
            if (this._functions[i].mode != newFunctions[i].mode) return true;
            if (this._functions[i].exec != newFunctions[i].exec) return true;
        }
        return false;
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
                await this._api.deleteLoco(this._params.id);
                nav.replaceParams({});
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
        this._updatePageParams();
        nav.open(FunctionSetupConstructor.path, this._functions);
        return false;
    }

    private _editCvs() {
        this._updatePageParams();
        nav.open(CvEditorConstructor.path, this._cvs);
        return false;
    }

    private _cancel() {
        // Revert any potentially updated page parameters
        const params: TrainEditParams = { id: this._params.id };
        nav.replaceParams(params);
        nav.back();
    }

    private _save(navBackOnSuccess: boolean) {
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
            if (this._params.id) {
                promise = this._api.updateLoco(this._params.id, name, address, speed, this._functions, this._cvs);
            }
            else {
                promise = this._api.addLoco(name, address, speed, this._functions, this._cvs).then((loco) => {
                    this._params.id = loco.id;
                    this._updatePageParams();
                });
            }

            promise.then(() => {
                if (!navBackOnSuccess) return;
                this._updatePageParams();
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