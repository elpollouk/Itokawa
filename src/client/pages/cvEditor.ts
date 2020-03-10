import { Page, IPageConstructor } from "./page";
import { parseHtml, getById } from "../utils/dom";
import { Client } from "../client";
import { CvControl } from "../controls/cvControl";
import { RequestType, LocoCvReadRequest, CvValuePair } from "../../common/messages";
const html = require("./cvEditor.html");

export class CvEditorPage extends Page {
    path: string = CvEditorConstructor.path;
    content: HTMLElement;

    private _cvContainer: HTMLElement;

    constructor () {
        super();
        this.content = this._buildUi();
    }

    private _buildUi(): HTMLElement {
        const page = parseHtml(html);

        this._cvContainer = getById(page, "cvContainer");
        getById(page, "refresh").onclick = () => this._refreshCvs(); 
        
        return page;
    }

    private _addCv(cv: number, value: number) {
        const cvControl = new CvControl(this._cvContainer, cv, value);
    }

    private _refreshCvs() {
        Client.instance.connection.request(RequestType.LocoCvRead, {
            cvs: [1, 3, 4, 7, 8, 10, 17, 18, 29 ]
        } as LocoCvReadRequest, (error, response) => {
            if (error) {
                console.log(error);
                return;
            }
            if (response.lastMessage) {
                return;
            }
            const data = response.data as CvValuePair;
            this._addCv(data.cv, data.value);
        })
        return false;
    }
}

export const CvEditorConstructor: IPageConstructor = {
    path: "cvEditor",
    create: () => new CvEditorPage()
}