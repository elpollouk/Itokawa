import { Client } from "../client";
import { RequestType, LifeCycleAction, LifeCycleRequest } from "../../common/messages";
import { Navigator as nav } from "../pages/page";
import { ControlBase } from "./control";
import * as protection from "./protectionControl";
import * as prompt from "../controls/promptControl";

// Controls used within the system drawer
import { PublicUrlQrCode } from "./publicUrlQrCode";
import { ConnectionStatus } from "./connectionStatus";
import { ConnectionState } from "../commandConnection";
import { UpdatePage, UpdatePageConstructor } from "../pages/update";
import { PromptButton } from "../controls/promptControl";
import { createElement } from "../utils/dom";

function createControlContainer(parent: HTMLElement) {
    const div = document.createElement("div");
    div.className = "container";
    parent.appendChild(div);
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

        const trainsButton = document.createElement("button");
        trainsButton.innerText = "Trains";
        trainsButton.onclick = () => nav.open("trains");
        globalControls.appendChild(trainsButton);

        const serverButton = document.createElement("button");
        serverButton.innerText = "Server";
        serverButton.onclick = () => this.openServerPopup();
        globalControls.appendChild(serverButton);

        // TODO - Fix this to be diven by the full screen event
        let isFullcreen = false;
        const fullscreenButton = document.createElement("button");
        fullscreenButton.innerText = "Maximise";
        fullscreenButton.onclick = () => {
            if (isFullcreen) {
                document.exitFullscreen();
                fullscreenButton.innerText = "Maximise";
                isFullcreen = false;
            }
            else {
                document.body.requestFullscreen();
                fullscreenButton.innerText = "Minimise";
                isFullcreen = true;
            }
        };
        globalControls.appendChild(fullscreenButton);

        // Back button
        const backButton = document.createElement("button");
        backButton.className = "backButton";
        backButton.onclick = (ev: MouseEvent) => {
            nav.back();
            // We don't want the click to raise the containers event in this case
            ev.stopPropagation();
        };
        backButton.innerText = "<";
        container.appendChild(backButton);

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
        const client = Client.instance;

        function action(caption: string, message: string, onyes:()=>void): PromptButton {
            return {
                caption: caption,
                onclick: () => prompt.confirm(message, onyes)
            }
        }

        prompt.stackedPrompt(
            "Server Control",[
                action("Shutdown", "Are you sure you want to shutdown server?", () => {
                    if (client.connection.state !== ConnectionState.Idle) return;
                    client.connection.request({
                        type: RequestType.LifeCycle,
                        action: LifeCycleAction.shutdown
                    } as LifeCycleRequest);
                }),
                action("Restart", "Are you sure you want to restart server?", () => {
                    if (client.connection.state !== ConnectionState.Idle) return;
                    client.connection.request({
                        type: RequestType.LifeCycle,
                        action: LifeCycleAction.restart
                    } as LifeCycleRequest);
                }),
                action("Update", "Are you sure you want to update server?", () => {
                    if (!(nav.currentPage instanceof UpdatePage))
                        nav.open(UpdatePageConstructor.path);
                }),
                { caption: "Cancel" }
            ]
        );
    }
}
