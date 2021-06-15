import { Page, IPageConstructor } from "./page";
import { parseHtml } from "../utils/dom";
const html = require("./attributions.html").default;

export class AttributionsPage extends Page {
    path: string = AttributionsConstructor.path;
    content: HTMLElement;
       
    constructor () {
        super();
        this.content = parseHtml(html);
    }
}

export const AttributionsConstructor: IPageConstructor = {
    path: "attributions",
    create: () => new AttributionsPage()
}