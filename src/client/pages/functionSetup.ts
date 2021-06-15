import { Page, IPageConstructor } from "./page";
import { parseHtml, getById } from "../utils/dom";
import { DraggableList } from "../controls/draggableList";
import { FunctionConfig, FunctionMode } from "../../common/api";

const html = require("./functionSetup.html").default;
const controlHtml = require("../controls/functionConfigControl.html").default;

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

export class FunctionSetupPage extends Page {
    path: string = FunctionSetupConstructor.path;
    content: HTMLElement;
    private _functionList: DraggableList<FunctionConfig>;

    get functions(): FunctionConfig[] {
        const value: FunctionConfig[] = [];
        for (const content of this._functionList.content()) {
            value.push({
                name: getById<HTMLInputElement>(content, "name").value,
                mode: _getMode(content),
                exec: getById<HTMLInputElement>(content, "function").value
            });
        }
        return value;
    }

    constructor (params: FunctionConfig[]) {
        super();
        this.content = this._buildUi();

        for (const func of params || []) {
            if (func.mode === FunctionMode.NotSet) continue;
            this._functionList.addItem(func);
        }
    }

    destroy() {
        this._functionList.close();
        super.destroy();
    }

    private _createFunctionUi(data: FunctionConfig) {
        const content = parseHtml(controlHtml);
        getById<HTMLInputElement>(content, "name").value = data.name;
        getById<HTMLSelectElement>(content, "mode").value = `${data.mode}`;
        getById<HTMLSelectElement>(content, "function").value = `${data.exec}`;
        return content;
    }

    private _buildUi(): HTMLElement {
        const page = parseHtml(html);
        
        const functionList = getById(page, "functionList");
        this._functionList = new DraggableList(functionList, (data) => this._createFunctionUi(data));
        this._functionList.onDelete = (item) => Promise.resolve(true);

        getById(page, "addFunction").onclick = () => this._functionList.addItem({ name: "", mode: FunctionMode.Trigger, exec: "0" });

        return page;
    }
}

export const FunctionSetupConstructor: IPageConstructor = {
    path: "functionSetup",
    create: (params) => new FunctionSetupPage(params)
}