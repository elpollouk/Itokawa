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
import { createElement } from "../utils/dom";
import { AboutControl } from "./about";

function createControlContainer(parent: HTMLElement) {
    const div = createElement(parent, "div");
    div.className = "container";
    return div;
}

export class SystemDrawControl extends ControlBase {
    constructor(parent: HTMLElement) {
        super();
        this._init(parent);
    }

    protected _buildUi(): HTMLElement {
        const container = document.createElement("div");

        new PublicUrlQrCode(createControlContainer(container));

        const globalControls = createControlContainer(container);
        globalControls.classList.add("globalControls");

        const trainsButton = createElement(globalControls, "button");
        trainsButton.innerText = "Trains";
        trainsButton.onclick = () => nav.open("trains");

        const serverButton = createElement(globalControls, "button");
        serverButton.innerText = "Server";
        serverButton.onclick = () => this.openServerPopup();

        const aboutButton = createElement(globalControls, "button");
        aboutButton.innerText = "About";
        aboutButton.onclick = () => this.openAbout();

        // Back button
        const backButton = createElement(container, "button");
        backButton.className = "backButton";
        backButton.onclick = (ev: MouseEvent) => {
            nav.back();
            // We don't want the click to raise the containers event in this case
            ev.stopPropagation();
        };
        backButton.innerText = "<";

        const handle = createElement(container, "div", "handle");
        handle.innerText = "...";

        new ConnectionStatus(container);


        // If the system drawer doesn't contain any children, then don't bother enabling
        // interactions with it
        container.onclick = () => {
            if (this.parent.classList.contains("expanded"))
                this.closeDrawer();
            else
                this.openDrawer();
        }

        return container;
    }

    private openDrawer() {
        this.parent.classList.add("expanded");
        protection.enableProtection(() => this.closeDrawer());
    }

    private closeDrawer() {
        this.parent.classList.remove("expanded");
        protection.disableProtection();
    }

    private openServerPopup() {
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

    private openAbout() {
        AboutControl.open();
    }
}
