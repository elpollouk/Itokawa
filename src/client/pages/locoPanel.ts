import { Page, IPageConstructor } from "./page";
import { parseHtml, getById } from "../utils/dom";
import { Loco, FunctionMode } from "../../common/api";
import { FunctionControl } from "../controls/functionControl";
import { TransportMessage, RequestType, LocoFunctionRequest, FunctionAction } from "../../common/messages";
import { client } from "../client";
const html = require("./locoPanel.html");

export class LocoPanelPage extends Page {
    path: string = LocoPanelConstructor.path;
    content: HTMLElement;
    private readonly _loco: Loco;
    private readonly _functionControls = new Map<number, FunctionControl>();
    private _messageHandlerToken: any;

    constructor(params: any) {
        super();
        this._loco = params;
        this.content = this._buildUi();

        this._messageHandlerToken = client.connection.on("message", (data: TransportMessage) => this._onMessage(data));
    }

    private _buildUi(): HTMLElement {
        const page = parseHtml(html);

        getById(page, "trainTitle").innerText = this._loco.name;
        const functionsContainer = getById(page, "functionsContainer");
        for (const config of this._loco.functions || []) {
            if (config.mode === FunctionMode.NotSet) continue;
            const control = new FunctionControl(functionsContainer, this._loco.address, config);
            if (config.mode === FunctionMode.Latched) {
                this._functionControls.set(parseInt(config.exec), control);
            }
        }

        return page;
    }

    private _onMessage(message: TransportMessage) {
        if (message.type !== RequestType.LocoFunction) return;
        const functionRequest = message.data as LocoFunctionRequest;
        if (functionRequest.locoId !== this._loco.address) return;

        const control = this._functionControls.get(functionRequest.function);
        control.latchedOn = functionRequest.action === FunctionAction.LatchOn;
    }

    destroy() {
        client.connection.off("message", this._messageHandlerToken);
        super.destroy();
    }
}

export const LocoPanelConstructor: IPageConstructor = {
    path: "locoPane;",
    create: (params) => new LocoPanelPage(params)
}
