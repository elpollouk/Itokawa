import { getById, parseHtml } from "../utils/dom";
import { IPageConstructor, Page } from "./page";
const html = require("./test.html").default;

class TestPage extends Page {
    path = TestPageConstructor.path;
    content: HTMLElement;

    constructor(message: string) {
        super();
        this.content = this._buildUi(message);
    }

    _buildUi(message: string): HTMLElement {
        const page = parseHtml(html);

        const content = getById(page, "content");
        content.innerText = message;
        
        return page;
    }
}

export const TestPageConstructor: IPageConstructor = {
    path: "test",
    create: (args: string) => new TestPage(args)
}