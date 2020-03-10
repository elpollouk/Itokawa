import { ControlBase } from "./control";
import { parseHtml, getById } from "../utils/dom";
const html = require("./cvControl.html");

export class CvControl extends ControlBase {
    private _valueElement: HTMLInputElement;

    get cv() {
        return this._cv;
    }

    get value() {
        return this._value;
    }

    get isDirty() {
        return this._valueElement.value !== `${this._value}`;
    }

    set value(v: number) {
        if (v < 0 || v > 255) throw new Error("Invalid CV value");
        this._value = v;
        this._valueElement.value = `${v}`;
    }

    constructor (parent: HTMLElement, private _cv: number, private _value: number) {
        super();
        if (_value < 0 || _value > 255) throw new Error("Invalid CV value");
        this._init(parent);
    }

    protected _buildUi(): HTMLElement {
        const control = parseHtml(html);

        getById(control, "cv").innerText = `${this._cv}`;
        this._valueElement = getById<HTMLInputElement>(control, "value");
        this._valueElement.value = `${this._value}`;
        this._valueElement.onchange = () => this._onValueChanged();
        this._valueElement.oninput = () => this._onValueChanged();

        return control
    }

    private _onValueChanged() {
        if (this.isDirty) {
            this.element.classList.add("dirty");
        }
        else {
            this.element.classList.remove("dirty");
        }
    }
}