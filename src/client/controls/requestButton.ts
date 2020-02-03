import { CommandConnection, ConnectionState } from "../commandConnection";
import { CommandRequest } from "../../common/messages";

export class RequestButton<T extends CommandRequest> {
    readonly element: HTMLElement;

    constructor(readonly parent: HTMLElement, readonly connection: CommandConnection, readonly title: string, readonly getMessage:()=>T) {
        this.element = this._buildUi();
        this.parent.appendChild(this.element);
    }

    _buildUi(): HTMLElement {
        const button = document.createElement("button");
        button.className = "requestButton";
        button.innerText = this.title;
        button.onclick = () => {
            if (this.connection.state !== ConnectionState.Idle) return;
            const message = this.getMessage();
            if (!message) return;
            this.connection.request(message);
        }
        return button;
    }
}