import { ControlBase } from "./control";
import { parseHtml, getById } from "../utils/dom";
import { FunctionMode } from "../../common/api";
const html = require("./functionConfigControl.html");

export class FunctionConfigControl extends ControlBase {
    constructor (parent: HTMLElement, private readonly _functionId: number, private readonly _originalMode: FunctionMode) {
        super();
        if (_functionId < 0 || _functionId > 28) throw new Error("Invalid function number");
        this._init(parent);
    }

    protected _buildUi(): HTMLElement {
        const control = parseHtml(html);

        getById(control, "functionId").innerText = `F${this._functionId}`;
        
        return control
    }
}
