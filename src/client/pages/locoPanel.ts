import { Page, IPageConstructor } from "./page";
import * as prompt from "../controls/promptControl";
import { parseHtml, getById } from "../utils/dom";
import { Loco, FunctionMode } from "../../common/api";
import { FunctionControl } from "../controls/functionControl";
import { TransportMessage, RequestType, LocoFunctionRequest, FunctionAction, LocoFunctionRefreshRequest, LocoSpeedRequest } from "../../common/messages";
import { client } from "../client";
import { TrainControl } from "../controls/trainControl";
const html = require("./locoPanel.html");

export class LocoPanelPage extends Page {
    path: string = LocoPanelConstructor.path;
    content: HTMLElement;
    private readonly _loco: Loco;
    private _speedControl: TrainControl;
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
        const speedContainer = getById(page, "speedContainer");
        this._speedControl = new TrainControl(speedContainer, this._loco, true);

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
        switch (message.type) {
            case RequestType.LocoSpeed:
                this._updateSpeed(message.data as LocoSpeedRequest);
                return;

            case RequestType.LocoFunction:
                this._updateFunction(message.data as LocoFunctionRequest);
                return;
        }
    }

    private _updateSpeed(request: LocoSpeedRequest) {
        if (request.locoId !== this._loco.address) return;
        this._speedControl.updateSpeed(request.speed, request.reverse);
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
        client.connection.request(RequestType.LocoSpeedRefresh, {
            locoId: this._loco.address
        } as LocoFunctionRefreshRequest, (err, response) => {
            if (err) {
                prompt.error(`Failed to refresh loco speed:\n${err.message}`);
                return;
            }
            if (response.lastMessage) return; // The last message is just "OK"
            this._updateSpeed(response.data as LocoSpeedRequest);
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
