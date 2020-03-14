import { client } from "../client";
import { ControlBase } from "./control";
import * as qrcode from "qrcode";

export class PublicUrlQrCode extends ControlBase {

    image: HTMLImageElement;
    url: HTMLAnchorElement;

    constructor(parent: HTMLElement) {
        super();
        this._init(parent);
        client.connection.bind("publicUrl", (url: string) => {
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

    protected _buildUi(): HTMLElement {
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