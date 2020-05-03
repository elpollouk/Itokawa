import { Page, IPageConstructor } from "./page";
import { parseHtml, getById } from "../utils/dom";
import { Loco, FunctionMode } from "../../common/api";
import { FunctionControl } from "../controls/functionControl";
const html = require("./locoPanel.html");

export class LocoPanelPage extends Page {
    path: string = LocoPanelConstructor.path;
    content: HTMLElement;
    private readonly _loco: Loco;

    constructor(params: any) {
        super();
        this._loco = params;
        this.content = this._buildUi();
    }

    private _buildUi(): HTMLElement {
        const page = parseHtml(html);

        getById(page, "trainTitle").innerText = this._loco.name;
        const functionsContainer = getById(page, "functionsContainer");
        for (const config of this._loco.functions || []) {
            if (config.mode === FunctionMode.NotSet) continue;
            new FunctionControl(functionsContainer, this._loco.address, config);
        }

        return page;
    }
}

export const LocoPanelConstructor: IPageConstructor = {
    path: "locoPane;",
    create: (params) => new LocoPanelPage(params)
}
