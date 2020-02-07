import { CommandConnection } from "../commandConnection";
import * as qrcode from "qrcode";

export class PublicUrlQrCode {
    readonly element: HTMLElement;

    image: HTMLImageElement;
    url: HTMLAnchorElement;

    constructor(readonly parent: HTMLElement, readonly connection: CommandConnection) {
        this.element = this._buildUi();
        this.parent.appendChild(this.element);
        connection.bind("publicUrl", (url: string) => {
            qrcode.toDataURL(url, (err, dataUrl) => {
                if (err) {
                    console.error(err);
                    return;
                }
                this.image.src = dataUrl;
                this.url.href = url;
                this.url.innerText = url;
            });
        });
    }

    private _buildUi(): HTMLElement {
        const container = document.createElement("div");
        container.className = "qrcode";

        let div = document.createElement("div");
        this.image = document.createElement("img");
        div.appendChild(this.image);
        container.append(div);

        div = document.createElement("div");
        this.url = document.createElement("a");
        div.appendChild(this.url);
        container.appendChild(div);

        return container;
    }
}