import { Page, IPageConstructor } from "./page";
import { parseHtml, getById } from "../utils/dom";
import { DraggableList } from "../controls/draggableList";
import { FunctionConfig, FunctionMode } from "../../common/api";

const html = require("./functionSetup2.html");
const controlHtml = require("../controls/functionConfigControl2.html");

function _getMode(content: HTMLElement): FunctionMode {
    const value = getById<HTMLSelectElement>(content, "mode").value;
    switch (value) {
        case "1":
            return FunctionMode.Trigger;
        case "2":
            return FunctionMode.Latched;
        default:
            return FunctionMode.NotSet;
    }
}

export class FunctionSetup2Page extends Page {
    path: string = FunctionSetup2Constructor.path;
    content: HTMLElement;
    private _functionList: DraggableList<FunctionConfig>;

    get functions(): FunctionConfig[] {
        const funcs: FunctionConfig[] = [];
        for (const content of this._functionList.content()) {
            funcs.push({
                name: getById<HTMLInputElement>(content, "name").value,
                mode: _getMode(content),
                exec: getById<HTMLInputElement>(content, "function").value
            });
        }
        return funcs;
    }

    constructor (params: FunctionConfig[]) {
        super();
        this.content = this._buildUi();

        for (const func of params || []) {
            if (func.mode === FunctionMode.NotSet) continue;
            this._functionList.addItem(func);
        }
    }

    private _createFunctionUi(data: FunctionConfig) {
        const content = parseHtml(controlHtml);
        getById<HTMLInputElement>(content, "name").value = data.name;
        getById<HTMLSelectElement>(content, "mode").value = `${data.mode}`;
        getById<HTMLSelectElement>(content, "function").value = `${data.exec}`;
        getById<HTMLButtonElement>(content, "delete").onclick = () => {
            this._functionList.removeItem(data);
        }
        return content;
    }

    private _buildUi(): HTMLElement {
        const page = parseHtml(html);
        
        const functionList = getById(page, "functionList");
        this._functionList = new DraggableList(functionList, (data) => this._createFunctionUi(data));

        getById(page, "addFunction").onclick = () => this._functionList.addItem({ name: "", mode: FunctionMode.Trigger, exec: "0" });

        return page;
    }
}

export const FunctionSetup2Constructor: IPageConstructor = {
    path: "functionSetup",
    create: (params) => new FunctionSetup2Page(params)
}