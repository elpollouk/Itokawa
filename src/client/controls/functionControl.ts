import { ControlBase } from "./control";
import { FunctionConfig, FunctionMode } from "../../common/api";

const LATCHED_CLASS = "latchedOn";

export class FunctionControl extends ControlBase {
    constructor(parent: HTMLElement, private readonly _locoId: number, private readonly _function: FunctionConfig) {
        super();
        this._init(parent);
    }

    protected _buildUi(): HTMLElement {
        const button = document.createElement("button");
        button.classList.add("function");
        button.innerText = this._function.name;
        button.onclick = () => this._onExecute();
        return button;
    }

    private _onExecute() {
        if (this._function.mode === FunctionMode.Latched) {
            if (this._element.classList.contains(LATCHED_CLASS)) {
                this._element.classList.remove(LATCHED_CLASS);
            }
            else {
                this._element.classList.add(LATCHED_CLASS);
            }
        }
    }
}