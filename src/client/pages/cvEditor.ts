import { Page, IPageConstructor, Navigator as nav } from "./page";
import { parseHtml, getById } from "../utils/dom";
import { Client } from "../client";
import { CvControl } from "../controls/cvControl";
import { RequestType, LocoCvReadRequest, CvValuePair } from "../../common/messages";
const html = require("./cvEditor.html");

export class CvEditorPage extends Page {
    path: string = CvEditorConstructor.path;
    content: HTMLElement;

    private _cvContainer: HTMLElement;
    private _cvControls = new Map<number, CvControl>();

    get cvs() {
        const c = {};
        this._cvControls.forEach((cv, key) => c[key] = cv.value);
        return c;
    }

    constructor (params: any) {
        super();
        this.content = this._buildUi();
        if (params) {
            for (const key in params) {
                const cv = parseInt(key);
                if (isNaN(cv)) continue;
                const value = params[key];
                if (!Number.isInteger(value)) continue;

                this._addCv(cv, value);
            }
        }
    }

    private _buildUi(): HTMLElement {
        const page = parseHtml(html);

        this._cvContainer = getById(page, "cvContainer");
        getById(page, "refresh").onclick = () => this._refreshCvs(); 
        
        return page;
    }

    protected _onOpen() {
        super.onEnter();
    }

    private _addCv(cv: number, value: number) {
        if (this._cvControls.has(cv)) {
            this._cvControls.get(cv).value = value;
        }
        else {
            const cvControl = new CvControl(this._cvContainer, cv, value);
            this._cvControls.set(cv, cvControl);
        }
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
                nav.replaceParams(this.cvs);
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
    create: (params) => new CvEditorPage(params)
}