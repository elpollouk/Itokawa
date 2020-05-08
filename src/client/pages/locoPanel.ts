import { Page, IPageConstructor } from "./page";
import * as prompt from "../controls/promptControl";
import { parseHtml, getById } from "../utils/dom";
import { Loco, FunctionMode } from "../../common/api";
import { FunctionControl } from "../controls/functionControl";
import { TransportMessage, RequestType, LocoFunctionRequest, FunctionAction, LocoFunctionRefreshRequest } from "../../common/messages";
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
        this._updateFunction(message.data as LocoFunctionRequest);
    }

    private _updateFunction(request: LocoFunctionRequest) {
        if (request.locoId !== this._loco.address) return;
        const control = this._functionControls.get(request.function);
        control.latchedOn = request.action === FunctionAction.LatchOn;
    }

    onEnter() {
        client.connection.request(RequestType.LocoFunctionRefresh, {
            locoId: this._loco.address
        } as LocoFunctionRefreshRequest, (err, response) => {
            if (err) {
                prompt.error(`Failed to refresh loco functions:\n${err.message}`);
                return;
            }
            if (response.lastMessage) return; // The last message is just "OK"
            this._updateFunction(response.data as LocoFunctionRequest);
        });
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
