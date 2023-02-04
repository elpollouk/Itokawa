import { Page, IPageConstructor, Navigator as nav } from "./page";
import * as prompt from "../controls/promptControl";
import { IApiClient, client } from "../client";
import { Loco } from "../../common/api";
import { createElement, parseHtml, getById } from "../utils/dom";
import { TrainEditConstructor } from "./trainEditor";
const html = require("./trainRoster.html").default;

function pad(address: number) {
    const addr = `${address}`;
    return "0000".substr(addr.length) + addr;
}

export class TrainRosterPage extends Page {
    path: string = TrainRosterConstructor.path;
    content: HTMLElement;
    
    private _trains: HTMLElement;
    private readonly _api: IApiClient;

    
    constructor () {
        super();
        this._api = client.api;
        this.content = this._buildUi();
    }

    private _buildUi(): HTMLElement {
        const page = parseHtml(html);

        this._trains = getById(page, "trains");
        getById(page, "new").onclick = () => nav.open(TrainEditConstructor.path);

        return page;
    }

    onEnter() {
        this._refreshTrains();
    }

    private _refreshTrains(): Promise<void> {
        return this._api.getLocos().then((locos) => {
            this._trains.innerHTML = "";

            const addTrain = (loco: Loco) => {
                const title = createElement(this._trains, "div", "train");
                title.innerText = `${pad(loco.address)} - ${loco.name}`;
                title.onclick = () => {
                    prompt.stackedPrompt(title.innerText, [
                        { caption: "Edit", onclick: () => {
                            nav.open(TrainEditConstructor.path, { id: loco.id })
                        }},
                        { caption: loco?._emphemeral?.onTrack ? "Remove from track" : "Add to track", onclick: () => {
                            let promise: Promise<void>;

                            if (loco?._emphemeral?.onTrack) {
                                loco._emphemeral.onTrack = false;
                                promise = this._api.removeFromTrack(loco.id);
                            }
                            else {
                                loco._emphemeral = { onTrack: true }
                                promise = this._api.addToTrack(loco.id);
                            }

                            promise.catch((err) => {
                                console.error(err);
                                prompt.error("Failed to update track");
                            });
                        }},
                        { caption: "Cancel" }
                    ]);
                }
            };

            for (const loco of locos) 
                addTrain(loco);
        }).catch((err) => {
            console.error(err);
            prompt.error("Failed to load train list.");
        });
    }
}

export const TrainRosterConstructor: IPageConstructor = {
    path: "trains",
    create: () => new TrainRosterPage()
}