import { CommandConnection } from "../commandConnection";
import * as qrcode from "qrcode";

export class PublicUrlQrCode {
    readonly element: HTMLElement;

    constructor(readonly parent: HTMLElement, readonly connection: CommandConnection) {
        this.element = this._buildUi();
        this.parent.appendChild(this.element);
        connection.onPublicUrlChanged = (url) => {
            qrcode.toDataURL(url, (err, dataUrl) => {
                if (err) {
                    console.error(err);
                    return;
                }
                (this.element as HTMLImageElement).src = dataUrl;
            });
        };
    }

    private _buildUi(): HTMLElement {
        const image = document.createElement("img");
        image.className = "qrcode";
        return image;
    }
}