import { Page, IPageConstructor } from "./page";
import { parseHtml, getById } from "../utils/dom";
import { FunctionConfigControl, FunctionMode } from "../controls/functionConfigControl";

const html = require("./functionSetup.html");

export class FunctionSetupPage extends Page {
    path: string = FunctionSetuprConstructor.path;
    content: HTMLElement;
    private readonly _functionControls: FunctionConfigControl[] = [];

    constructor (params: any) {
        super();
        this.content = this._buildUi();
    }

    private _buildUi(): HTMLElement {
        const page = parseHtml(html);
        
        const functionContainer = getById(page, "functionContainer");
        for (let i = 0; i < 29; i++) {
            const control = new FunctionConfigControl(functionContainer, i, FunctionMode.NotSet);
            this._functionControls.push(control);
        }

        return page;
    }
}

export const FunctionSetuprConstructor: IPageConstructor = {
    path: "functionEditor",
    create: (params) => new FunctionSetupPage(params)
}
