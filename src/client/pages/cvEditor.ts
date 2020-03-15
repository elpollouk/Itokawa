import { Page, IPageConstructor, Navigator as nav } from "./page";
import { parseHtml, getById } from "../utils/dom";
import * as prompt from "../controls/promptControl";
import { client } from "../client";
import { CvControl, State } from "../controls/cvControl";
import { RequestType, LocoCvReadRequest, CvValuePair, LocoCvWriteRequest } from "../../common/messages";
import { CvMap } from "../../common/api";
import { loadData, getLocoDecoderProfile, LocoDecoderProfile } from "../utils/decoders";
const html = require("./cvEditor.html");

export class CvEditorPage extends Page {
    path: string = CvEditorConstructor.path;
    content: HTMLElement;

    private _cvContainer: HTMLElement;
    private _cvControls = new Map<number, CvControl>();
    private _manufacturer: number;
    private _version: number;

    get cvs(): CvMap {
        const c = {};
        this._cvControls.forEach((cv, key) => c[key] = cv.value);
        c[8] = this._manufacturer;
        c[7] = this._version;
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
        if (cv === 8) {
            this._manufacturer = value;
        }
        else if (cv === 7) {
            this._version = value;
        }
        else if (this._cvControls.has(cv)) {
            this._cvControls.get(cv).value = value;
        }
        else {
            const cvControl = new CvControl(this._cvContainer, cv, value);
            this._cvControls.set(cv, cvControl);
        }
    }

    private _refreshCvs() {
        // These are the standard Hornby CVs for now
        this._readCvsAsync().catch((error) => {
            console.error(error);
            prompt.error(error.message);
        });

        return false;
    }

    private async _readCvsAsync() {
        const profile = await this._getDecoderProfile();

        if (!profile) {
            throw new Error(`No profile defined for manufacturer ${this._manufacturer}, version ${this._version}`);
        }

        const batch =  profile.cvs;

        for (const cv of batch) {
            if (!this._cvControls.has(cv)) continue;
            this._cvControls.get(cv).state = State.updating;
        }

        // Remove old CVs that aren't part of the new profile
        for (const pair of this._cvControls) {
            if (pair[1].state === State.updating) continue;
            pair[1].close();
            this._cvControls.delete(pair[0]);
        }

        await this._readCvBatch(batch);
    }

    private _getDecoderProfile(): Promise<LocoDecoderProfile> {
        // Attempt to auto detect the decoder profile
        // Reset the info we have so that we can detect errors
        this._manufacturer = 0;
        this._version = 0;
        let message: prompt.PromptControl;
    
        return new Promise<LocoDecoderProfile>((resolve, reject) => {
            message = prompt.prompt("Detecting decoder profile...", []);
            client.connection.request(RequestType.LocoCvRead, {
                cvs: [7, 8]
            } as LocoCvReadRequest, (error, response) => {
                if (error) {
                    reject(error);
                    return;
                }

                if (response.lastMessage) {
                    // Verify we have the info we need before performing the look up
                    if (this._manufacturer === 0) {
                        reject(new Error("No manufacturer id returned from loco"));
                    }
                    else if (this._version === 0) {
                        reject(new Error("No version number returned from loco"));
                    }
                    else {
                        resolve(getLocoDecoderProfile(
                            this._manufacturer, 
                            this._version
                        ));
                    }
                    return;
                }

                // Store the details as we encounter them
                const pair = response.data as CvValuePair;
                if (pair.cv === 7) {
                    this._version = pair.value;
                }
                else if (pair.cv === 8) {
                    this._manufacturer = pair.value;
                }
                else {
                    reject(new Error(`Unexpected CV encountered: ${pair.cv}`));
                }
            });
        })
        .finally(() => {
            message.close();
        });
    }

    private _readCvBatch(batch: number[]): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            client.connection.request(RequestType.LocoCvRead, {
                cvs: batch
            } as LocoCvReadRequest, (error, response) => {
                if (error) {
                    reject(error);
                }
                else if (response.lastMessage) {
                    nav.replaceParams(this.cvs);
                    resolve();
                }
                else {
                    const data = response.data as CvValuePair;
                    this._addCv(data.cv, data.value);
                }
            });
        })
    }

    private _writeCvs() {
        let anyDirty = false;
        this._cvControls.forEach((cv) => anyDirty = anyDirty || cv.isDirty);
        if (!anyDirty) {
            prompt.message("No CV values have been changed");
            return;
        }

        prompt.confirm("Are you sure you you wish to write CV values").then((yes) => {
            if (!yes) return;

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
            } as LocoCvWriteRequest, (error, response) => {
                if (error) {
                    console.log(error);
                    prompt.error(error.message);
                }
                else if (response.lastMessage) {
                    nav.replaceParams(this.cvs);
                }
                else {
                    const data = response.data as CvValuePair;
                    this._addCv(data.cv, data.value);
                }
            });
            return false;
        });
    }
}

export const CvEditorConstructor: IPageConstructor = {
    path: "cvEditor",
    create: (params) => new CvEditorPage(params)
}