import { Page, IPageConstructor } from "./page";
import { parseHtml } from "../utils/dom";

const html = require("./functionSetup.html");

export class FunctionSetupPage extends Page {
    path: string = FunctionSetuprConstructor.path;;
    content: HTMLElement;

    constructor (params: any) {
        super();
        this.content = this._buildUi();
    }

    private _buildUi(): HTMLElement {
        const page = parseHtml(html);
        
        return page;
    }
}

export const FunctionSetuprConstructor: IPageConstructor = {
    path: "functionEditor",
    create: (params) => new FunctionSetupPage(params)
}
