import { client } from "../client";
import { RequestType, LifeCycleAction, LifeCycleRequest } from "../../common/messages";
import { Navigator as nav } from "../pages/page";
import { ControlBase } from "./control";
import * as protection from "./protectionControl";
import * as prompt from "../controls/promptControl";

// Controls used within the system drawer
import { PublicUrlQrCode } from "./publicUrlQrCode";
import { ConnectionStatus } from "./connectionStatus";
import { ConnectionState } from "../client";
import { UpdatePage, UpdatePageConstructor } from "../pages/update";
import { PromptButton } from "../controls/promptControl";
import { getById, parseHtml } from "../utils/dom";
import { AboutControl } from "./about";

const html = require("./systemDrawer.html").default;

export class SystemDrawControl extends ControlBase {
    constructor(parent: HTMLElement) {
        super();
        this._init(parent);
    }

    protected _buildUi(): HTMLElement {
        const container = parseHtml(html);

        new PublicUrlQrCode(getById(container, "qrContainer"));
        getById(container, "trains").onclick = () => this._openTrainsScreen();
        getById(container, "server").onclick = () => this._openServerPopup();
        getById(container, "about").onclick = () => this._openAbout();
        getById(container, "estop").onclick = (ev) => {
            this._emergencyStop();
            // We want to keep the panel open
            ev.stopPropagation();
        };
        getById(container, "back").onclick = (ev: MouseEvent) => {
            nav.back();
            // We don't want the click to raise the containers event in this case
            ev.stopPropagation();
        };
        new ConnectionStatus(container);

        // If the system drawer doesn't contain any children, then don't bother enabling
        // interactions with it
        container.onclick = () => {
            if (this.parent.classList.contains("expanded"))
                this._closeDrawer();
            else
                this._openDrawer();
        }

        return container;
    }

    private _openDrawer() {
        this.parent.classList.add("expanded");
        protection.enableProtection(() => this._closeDrawer());
    }

    private _closeDrawer() {
        this.parent.classList.remove("expanded");
        protection.disableProtection();
    }

    private _openTrainsScreen() {
        if (client.requireSignIn()) return;
        nav.open("trains");
    }

    private _openServerPopup() {
        if (client.requireSignIn()) return;

        function action(caption: string, message: string, onyes:()=>void): PromptButton {
            return {
                caption: caption,
                onclick: () => prompt.confirm(message).then((yes) => { if (yes) onyes(); })
            }
        }

        prompt.stackedPrompt(
            "Server Control", [
                action("Shutdown", "Are you sure you want to shutdown server?", () => {
                    if (client.connection.state !== ConnectionState.Idle) return;
                    client.connection.request<LifeCycleRequest>(RequestType.LifeCycle, {
                        action: LifeCycleAction.shutdown
                    }, (err) => {
                        if (err) prompt.error(err.message);
                    });
                }),
                action("Restart", "Are you sure you want to restart server?", () => {
                    if (client.connection.state !== ConnectionState.Idle) return;
                    client.connection.request<LifeCycleRequest>(RequestType.LifeCycle, {
                        action: LifeCycleAction.restart
                    }, (err) => {
                        if (err) prompt.error(err.message);
                    });
                }),
                action("Update", "Are you sure you want to update server?", () => {
                    if (!(nav.currentPage instanceof UpdatePage))
                        nav.open(UpdatePageConstructor.path, LifeCycleAction.update);
                }),
                action("Update OS", "Are you sure you want to update the server OS?", () => {
                    if (!(nav.currentPage instanceof UpdatePage))
                        nav.open(UpdatePageConstructor.path, LifeCycleAction.updateOS);
                }),
                { caption: "Cancel" }
            ]
        );
    }

    private _openAbout() {
        AboutControl.open();
    }

    private _emergencyStop() {
        const connection = client.connection;
        if (connection.state !== ConnectionState.Idle) {
            setTimeout(() => this._emergencyStop(), 100);
            return;
        }

        connection.request(RequestType.EmergencyStop, null);
    }
}
