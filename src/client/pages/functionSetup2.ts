import { Page, IPageConstructor } from "./page";
import { parseHtml, getById } from "../utils/dom";
import { DraggableList } from "../controls/draggableList";
import { FunctionConfig } from "../../common/api";

const html = require("./functionSetup2.html");
const controlHtml = require("../controls/functionConfigControl2.html");

interface FunctionData {
    name: string;
}

export class FunctionSetup2Page extends Page {
    path: string = FunctionSetup2Constructor.path;
    content: HTMLElement;
    private _functionList: DraggableList<FunctionData>;

    constructor (params: FunctionConfig[]) {
        super();
        this.content = this._buildUi();
    }

    private _createFunctionUi(data: FunctionData) {
        const content = parseHtml(controlHtml);
        getById<HTMLInputElement>(content, "name").value = data.name;
        getById<HTMLButtonElement>(content, "delete").onclick = () => {
            this._functionList.removeItem(data);
        }
        return content;
    }

    private _buildUi(): HTMLElement {
        const page = parseHtml(html);
        
        const functionList = getById(page, "functionList");
        this._functionList = new DraggableList(functionList, (data) => this._createFunctionUi(data));

        getById(page, "addFunction").onclick = () => this._functionList.addItem({ name: "" });

        return page;
    }
}

export const FunctionSetup2Constructor: IPageConstructor = {
    path: "functionSetup",
    create: (params) => new FunctionSetup2Page(params)
}