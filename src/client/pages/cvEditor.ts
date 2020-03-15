import { Page, IPageConstructor, Navigator as nav } from "./page";
import { parseHtml, getById } from "../utils/dom";
import * as prompt from "../controls/promptControl";
import { client } from "../client";
import { CvControl, State } from "../controls/cvControl";
import { RequestType, LocoCvReadRequest, CvValuePair, LocoCvWriteRequest } from "../../common/messages";
import { CvMap } from "../../common/api";
import { loadData } from "../utils/decoders";
const html = require("./cvEditor.html");

export class CvEditorPage extends Page {
    path: string = CvEditorConstructor.path;
    content: HTMLElement;

    private _cvContainer: HTMLElement;
    private _cvControls = new Map<number, CvControl>();

    get cvs(): CvMap {
        const c = {};
        this._cvControls.forEach((cv, key) => c[key] = cv.value);
        return c;
    }

    constructor (params: any) {
        super();
        this.content = this._buildUi();

        loadData((error) => {
            if (error) {
                console.error(error);
                prompt.error(error.message);
            }
            else if (params) {
                for (const key in params) {
                    const cv = parseInt(key);
                    if (isNaN(cv)) continue;
                    const value = params[key];
                    if (!Number.isInteger(value)) continue;
    
                    this._addCv(cv, value);
                }
            }
        });
    }

    private _buildUi(): HTMLElement {
        const page = parseHtml(html);

        this._cvContainer = getById(page, "cvContainer");
        getById(page, "refresh").onclick = () => this._refreshCvs(); 
        getById(page, "write").onclick = () => this._writeCvs();
        
        return page;
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

    private _onCvResponse(error: Error, response: any) {
        if (error) {
            console.log(error);
            prompt.error(error.message);
            return;
        }
        if (response.lastMessage) {
            nav.replaceParams(this.cvs);
            return;
        }
        const data = response.data as CvValuePair;
        this._addCv(data.cv, data.value);
    }

    private _refreshCvs() {
        // These are the standard Hornby CVs for now
        const batch = [1, 3, 4, 7, 8, 10, 17, 18, 29];

        for (const cv of batch) {
            if (!this._cvControls.has(cv)) continue;
            this._cvControls.get(cv).state = State.updating;
        }

        client.connection.request(RequestType.LocoCvRead, {
            cvs: batch
        } as LocoCvReadRequest, (e, r) => this._onCvResponse(e, r));
        return false;
    }

    private _writeCvs() {
        let anyDirty = false;
        this._cvControls.forEach((cv) => anyDirty = anyDirty || cv.isDirty);
        if (!anyDirty) {
            prompt.message("No CV values have been changed");
            return;
        }

        prompt.confirm("Are you sure you you wish to write CV values", () => {
            const batch: CvValuePair[] = [];
            this._cvControls.forEach((cv, key) => {
                if (!cv.isDirty) return;
                batch.push({
                    cv: key,
                    value: cv.value
                })
                cv.state = State.updating;
            });

            client.connection.request(RequestType.LocoCvWrite, {
                cvs: batch
            } as LocoCvWriteRequest, (e, r) => this._onCvResponse(e, r));
            return false;
        });
    }
}

export const CvEditorConstructor: IPageConstructor = {
    path: "cvEditor",
    create: (params) => new CvEditorPage(params)
}