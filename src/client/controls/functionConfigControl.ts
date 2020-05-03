import { ControlBase } from "./control";
import { parseHtml, getById } from "../utils/dom";
import { FunctionMode, FunctionConfig } from "../../common/api";
const html = require("./functionConfigControl.html");

export class FunctionConfigControl extends ControlBase {
    private _modeControl: HTMLSelectElement;

    get name() {
        return this._originalConfig.name;
    }

    get mode(): FunctionMode {
        const value = this._modeControl.value;
        switch (value) {
            case "1":
                return FunctionMode.Trigger;
            case "2":
                return FunctionMode.Latched;
            default:
                return FunctionMode.NotSet;
        }
    }

    get exec() {
        return this._originalConfig.exec;
    }

    constructor (parent: HTMLElement, private readonly _originalConfig: FunctionConfig) {
        super();
        this._init(parent);
    }

    protected _buildUi(): HTMLElement {
        const control = parseHtml(html);

        getById(control, "functionId").innerText = this._originalConfig.name;
        this._modeControl = getById(control, "mode");
        this._modeControl.options[this._originalConfig.mode].selected = true;

        return control
    }
}
