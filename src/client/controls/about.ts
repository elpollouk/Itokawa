import { ControlBase } from "./control";
import { parseHtml, getById } from "../utils/dom";
import * as popup from "./popup";
import { Client } from "../client";
const html = require("./about.html");

const REVISION_URL = "https://github.com/elpollouk/Itokawa/tree/";

export class AboutControl extends ControlBase {
    static open() {
        const about = new AboutControl();
        popup.add(about);
    }

    private constructor() {
        super();
        this._init();
        this.element.onclick = (ev) => {
            ev.stopImmediatePropagation();
        }
    }

    protected _buildUi(): HTMLElement {
        const control = parseHtml(html);
        const connection = Client.instance.connection;

        const revision = connection.gitRevision || "";
        getById(control, "version").innerText = connection.packageVersion;
        getById(control, "commandStation").innerText = connection.deviceId;
        getById(control, "gitRev").innerText = revision.substr(0, 8);
        getById<HTMLAnchorElement>(control, "gitRev").href = REVISION_URL + revision;

        getById(control, "close").onclick = () => this.close();
        return control;
    }

    close() {
        super.close();
        popup.remove(this);
    }

}