import { ControlBase } from "./control";
import { Navigator as nav } from "../pages/page";
import { parseHtml, getById } from "../utils/dom";
import * as popup from "./popup";
import { client } from "../client";
import { AttributionsConstructor } from "../pages/attributions";
import { getDecoderDataVersion, loadData } from "../utils/decoders";
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
        const connection = client.connection;

        const revision = connection.gitRevision || "";
        getById(control, "appVersion").innerText = connection.packageVersion;
        getById(control, "commandStation").innerText = connection.deviceId;
        getById(control, "gitRev").innerText = revision.substr(0, 8);
        getById<HTMLAnchorElement>(control, "gitRev").href = REVISION_URL + revision;

        getById(control, "attributions").onclick = () => this._openAttributions();
        getById(control, "close").onclick = () => this.close();

        const dataVersionControl = getById(control, "dataVersion");
        dataVersionControl.innerText = "Fetching...";
        loadData((error) => {
            if (error) {
                dataVersionControl.innerText = "Failed to download data"
            }
            else {
                dataVersionControl.innerText = getDecoderDataVersion();
            }
        });
        
        return control;
    }

    close() {
        super.close();
        popup.remove(this);
    }

    _openAttributions() {
        nav.open(AttributionsConstructor.path);
        this.close();
        return false;
    }
}