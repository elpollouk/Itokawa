import { Page, IPageConstructor } from "./page";
import { parseHtml, getById } from "../utils/dom";
import { FunctionConfigControl } from "../controls/functionConfigControl";
import { FunctionMode, FunctionConfig } from "../../common/api";

const html = require("./functionSetup.html");

export class FunctionSetupPage extends Page {
    path: string = FunctionSetuprConstructor.path;
    content: HTMLElement;
    private _functions: FunctionConfig[];
    private readonly _functionControls: FunctionConfigControl[] = [];

    get functions(): FunctionConfig[] {
        const value: FunctionConfig[] = [];
        for (const control of this._functionControls) {
            //if (control.mode == FunctionMode.NotSet) continue;
            value.push({
                name: control.name,
                mode: control.mode,
                exec: control.exec
            });
        }
        return value;
    }

    constructor (params: any) {
        super();
        if (params.length === 0) {
            this._functions = [];
            for (let i = 0; i < 29; i++) {
                this._functions.push({
                    name: `F${i}`,
                    mode: FunctionMode.NotSet,
                    exec: `${i}`
                });
            }
        }
        else {
            this._functions = params as FunctionConfig[];
        }
        this.content = this._buildUi();
    }

    private _buildUi(): HTMLElement {
        const page = parseHtml(html);
        
        const functionContainer = getById(page, "functionContainer");
        for (const config of this._functions) {
            const control = new FunctionConfigControl(functionContainer, config);
            this._functionControls.push(control);
        }

        return page;
    }
}

export const FunctionSetuprConstructor: IPageConstructor = {
    path: "functionEditor",
    create: (params) => new FunctionSetupPage(params)
}
