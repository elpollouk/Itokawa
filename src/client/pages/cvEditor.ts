import { Page, IPageConstructor, Navigator as nav } from "./page";
import { parseHtml, getById } from "../utils/dom";
import * as prompt from "../controls/promptControl";
import { client } from "../client";
import { CvControl, State } from "../controls/cvControl";
import { RequestType, LocoCvReadRequest, CvValuePair, LocoCvWriteRequest } from "../../common/messages";
import { CvMap } from "../../common/api";
import { loadData, getLocoDecoderProfile, LocoDecoderProfile, getLocoScanCvs, getLocoCvName } from "../utils/decoders";
const html = require("./cvEditor.html").default;

export class CvEditorPage extends Page {
    path: string = CvEditorConstructor.path;
    content: HTMLElement;

    private _manufacturerText: HTMLElement;
    private _decoderText: HTMLElement;
    private _cvContainer: HTMLElement;
    private _cvControls = new Map<number, CvControl>();
    private _manufacturer: number = 0;
    private _version: number = 0;

    get cvs(): CvMap {
        const c = {};
        this._cvControls.forEach((cv, key) => c[key] = cv.value);
        if (this._manufacturer && this._version) {
            // We don't want to set the manufacturer or version if they've not been set
            // to prevent the train editor page for prompting us to save if there are
            // no CVs.
            c[8] = this._manufacturer;
            c[7] = this._version;
        }
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
    
                    this._addCv(cv, getLocoCvName(params[8], params[7], cv), value);
                }

                // If we don't have any decoder details yet, don't show anything for them to keep the
                // UI clean.
                if (this._manufacturer || this._version) {
                    this._updateDecoderInfo(getLocoDecoderProfile(this._manufacturer, this._version));
                }
            }
        });
    }

    private _buildUi(): HTMLElement {
        const page = parseHtml(html);

        this._manufacturerText = getById(page, "manufacturer");
        this._decoderText = getById(page, "decoder");
        this._cvContainer = getById(page, "cvContainer");
        getById(page, "refresh").onclick = () => this._refreshCvs(); 
        getById(page, "write").onclick = () => this._writeCvs();
        
        return page;
    }

    private _updateDecoderInfo(profile: LocoDecoderProfile) {
        let manufacturer: string;
        let decoder: string;
        if (profile) {
            manufacturer = profile.manufacturer;
            decoder = profile.name;
        }

        this._manufacturerText.innerText = manufacturer || "Unknown manufacturer";
        this._decoderText.innerText = decoder || "Unknown decoder";
    }

    private _addCv(cv: number, cvName: string, value: number) {
        if (cv === 8) {
            this._manufacturer = value;
        }
        else if (cv === 7) {
            this._version = value;
        }
        else {
            let control = this._cvControls.get(cv);
            if (!control) {
                control = new CvControl(this._cvContainer, cv, cvName, value);
                this._cvControls.set(cv, control);
            }
            else {
                control.value = value;
            }
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
        this._updateDecoderInfo(profile);

        let batch: number[];
        if (profile) {
            batch =  profile.cvs;
        }
        else {
            const yes = await prompt.confirm(`No profile defined for manufacturer ${this._manufacturer}, version ${this._version}.\nWould you like to perform a full scan?`);
            if (!yes) return;
            batch = getLocoScanCvs();
        }         

        for (const cv of batch) {
            if (!this._cvControls.has(cv)) {
                // Pre-populate CVs that aren't in the UI yet
                const cvName = getLocoCvName(this._manufacturer, this._version, cv);
                this._addCv(cv, cvName, 0);
            };
            this._cvControls.get(cv).state = State.updating;
        }

        // Remove old CVs that aren't part of the new profile. We can identify these as we won't have
        // marked them as updating in the previous loop
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
                    if (this._version !== pair.value) {
                        this._cvContainer.innerHTML = "";
                        this._cvControls.clear();
                    }
                    this._version = pair.value;
                }
                else if (pair.cv === 8) {
                    if (this._manufacturer !== pair.value) {
                        this._cvContainer.innerHTML = "";
                        this._cvControls.clear();
                    }
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
                    const cvName = getLocoCvName(this._manufacturer, this._version, data.cv);
                    this._addCv(data.cv, cvName, data.value);
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
                    const cvName = getLocoCvName(this._manufacturer, this._version, data.cv);
                    this._addCv(data.cv, cvName, data.value);
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