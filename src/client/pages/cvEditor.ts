import { Page, IPageConstructor } from "./page";
import { parseHtml } from "../utils/dom";
const html = require("./cvEditor.html");

export class CvEditorPage extends Page {
    path: string = CvEditorConstructor.path;
    content: HTMLElement;
       
    constructor () {
        super();
        this.content = parseHtml(html);
    }
}

export const CvEditorConstructor: IPageConstructor = {
    path: "cvEditor",
    create: () => new CvEditorPage()
}