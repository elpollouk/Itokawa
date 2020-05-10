import { Page, IPageConstructor } from "./page";
import { parseHtml, getById } from "../utils/dom";
import { DraggableList } from "../controls/draggableList";

const html = require("./functionSetup2.html");

interface FunctionData {
    name: string;
}

export class FunctionSetup2Page extends Page {
    path: string = FunctionSetup2Constructor.path;
    content: HTMLElement;
    private _functionList: DraggableList<FunctionData>;

    constructor (params: any) {
        super();
        this.content = this._buildUi();
    }

    private _createFunctionUi(data: FunctionData) {
        const span = document.createElement("span");
        span.innerText = data.name;
        return span;
    }

    private _buildUi(): HTMLElement {
        const page = parseHtml(html);
        
        const functionList = getById(page, "functionList");
        this._functionList = new DraggableList(functionList, (data) => this._createFunctionUi(data));

        this._functionList.addItem({ name: "A" });
        this._functionList.addItem({ name: "B" });
        this._functionList.addItem({ name: "C" });

        return page;
    }
}

export const FunctionSetup2Constructor: IPageConstructor = {
    path: "functionSetup",
    create: (params) => new FunctionSetup2Page(params)
}