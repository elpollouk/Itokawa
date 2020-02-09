import * as fs from "fs";
import * as xml2js from "xml2js";
import { Logger } from "./logger";
import { splitStringEx } from "./parsers";

const log = new Logger("Config");

type Value = string | number | boolean | ConfigNode;

export class ConfigNode {
    has(path: string): boolean {
        return typeof(this.get(path)) !== "undefined";
    }

    get(path: string, defaultValue?: Value): Value {
        const _path = splitStringEx(path, ["."], "\"", "^");
        return this._get(_path, defaultValue);
    }

    getAs<T extends Value>(path: string, defaultValue?: T): T {
        return this.get(path, defaultValue) as T;
    }

    private _get(path: string[], defaultValue?: Value): Value {
        const key = path.shift();
        if (!(key in this)) return defaultValue;
        
        const value = this[key];
        // If there are still path components, then we need to go deeper into the config
        if (path.length !== 0) {
            if (value instanceof ConfigNode && path.length !== 0) return value._get(path, defaultValue);
            // We can't go any deeper from here, so return the default value
            return defaultValue;
        }

        return value;
    }

    set(path: string, value: Value) {
        const _path = splitStringEx(path, ["."], "\"", "^");
        return this._set(_path, value);
    }

    private _set(path: string[], value?: Value) {
        const key = path.shift();
        if (path.length === 0) {
            this[key] = value;
            return;
        }

        if (!(key in this) || !(this[key] instanceof ConfigNode)) {
            const newNode = new ConfigNode();
            this[key] = newNode;
            newNode._set(path, value);
            return
        }

        const node = this[key];
        node._set(path, value);
    }
}

export async function loadConfig(path: string): Promise<ConfigNode> {
    try {
        log.info(() => `Loading ${path}`);
        if (!fs.existsSync(path)) {
            log.warning(`${path} does not exist`);
            return new ConfigNode();
        }

        const xml = fs.readFileSync(path, {
            encoding: "utf8"
        });

        const parser = new xml2js.Parser({ attrkey: "_attr" });
        const data = await parser.parseStringPromise(xml);

        return _parseNode(data["config"]);
    }
    catch (ex) {
        log.error(`Error while loading ${path}`);
        log.error(ex);
        return new ConfigNode();
    }
}

const _PARSERS = {
    "bool": (value: any) => `${value}`.toLowerCase() === "true",
    "number": (value: any) => parseFloat(value),
    "float": (value: any) => parseFloat(value),
    "int": (value: any) => parseInt(value),
    "string": (value: any) => `${value}`
};

interface TypeDetector {
    regex: RegExp,
    typeName: string
};

const _TYPE_DETECTORS: TypeDetector[] = [
    { regex: /^\d+\.\d*$/, typeName: "float" },
    { regex: /^\d+$/, typeName: "int" },
    { regex: /^[tT][rR][uU][eE]$|^[fF][aA][lL][sS][eE]$/, typeName: "bool" }
];

function _autoParseValue(value: string): number | boolean | string {
    for (const detector of _TYPE_DETECTORS)
        if (detector.regex.test(value))
            return _PARSERS[detector.typeName](value);

    return value;
}

function _autoDetectType(value: string) {
    for (const detector of _TYPE_DETECTORS)
        if (detector.regex.test(value))
            return detector.typeName;

    return "string";
}

function _parseNode(data: any): ConfigNode {
    const node = new ConfigNode();

    for (const key in data) {
        const children = data[key] as any[];
        const value = children[0];

        if (value instanceof Object) {
            if ("_" in value) {
                const type = value._attr["type"];
                if (type in _PARSERS) {
                    node[key] = _PARSERS[type](value._);
                }
                else {
                    node[key] = _autoParseValue(value._);
                }
            }
            else{
                node[key] = _parseNode(value);
            }
        }
        else{
            node[key] = _autoParseValue(value);
        }
    }

    return node;
}

export async function saveConfig(path: string, config: ConfigNode) {
    const buffer = [ "<config>\n"];

    _writeNode(buffer, config, 1);

    buffer.push("</config>");
    fs.writeFileSync(path, buffer.join(""), {
        encoding: "utf8"
    });
}

function _writeNode(buffer: any[], node: ConfigNode, indent: number) {
    for (const key in node) {
        const value = node[key];
        const type = typeof(value);

        _writeIndent(buffer, indent);
        buffer.push(`<${key}`);
        if (type == "object") {
            buffer.push(">\n");
            _writeNode(buffer, value, indent + 1);
            _writeIndent(buffer, indent);
        }
        else {
            if (typeof(value) === "string" && _autoDetectType(`${value}`) !== "string") {
                buffer.push(' type="string"');
            }
            buffer.push(">");
            buffer.push(value);
        }
        buffer.push(`</${key}>\n`);
    }
}

function _writeIndent(buffer: any[], indent: number) {
    for (let i = 0; i < indent; i++){
        buffer.push("    ");
    }
}