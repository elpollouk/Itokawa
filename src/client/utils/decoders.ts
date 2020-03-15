export interface LocoDecoderProfile {
    name: string;
    cvs: number[];
};

export const Manufactures = {};
export const LocoCvNames = {};
export const LocoDecoderProfiles = new Map<number, Map<number, LocoDecoderProfile>>();

function parseData(data: Document) {
    const root = data.getElementsByTagName("decoders")[0];

    // Load up the manufacturers
    const manufacturers = root.getElementsByTagName("manufacturers")[0].children;
    for (let i = 0; i < manufacturers.length; i++) {
        const node = manufacturers[i];
        if (node.nodeName !== "man") continue;
        const id = node.attributes.getNamedItem("n").nodeValue;
        if (id in Manufactures) throw Error(`Duplicate manufacturer ${id} encountered: ${node.textContent}`);
        Manufactures[id] = node.textContent;
    };
    
    // Load up loco CVs
    const locoCvs = root.getElementsByTagName("locoCvNames")[0].children;
    for (let i = 0; i < locoCvs.length; i++) {
        const node = locoCvs[i];
        if (node.nodeName !== "cv") continue;
        const id = node.attributes.getNamedItem("n").nodeValue;
        if (id in LocoCvNames) throw Error(`Duplicate CV ${id} encountered: ${node.textContent}`);
        LocoCvNames[id] = node.textContent;
    }

    // Load profiles
    const profiles = root.getElementsByTagName("locoDecoders")[0].children
    for (let i = 0; i < profiles.length; i++) {
        const node = profiles[i];
        if (node.nodeName !== "profile") continue;
        loadProfile(node);
    }
}

function parseNumberList(input: string): number[] {
    const result = [];
    for (const valueString of input.split(",")) {
        const value = parseInt(valueString);
        if (isNaN(value)) throw new Error(`Invalid number encountered: ${valueString}`);
        result.push(value);

    }
    return result;
}

function loadProfile(profile: Element) {
    const name = profile.attributes.getNamedItem("name").nodeValue;
    let rawValue = profile.attributes.getNamedItem("man").nodeValue;
    const manufacturer = parseInt(rawValue);
    if (isNaN(manufacturer)) throw new Error(`Invalid manufacturer id encountered: ${rawValue}`);
    const versions = parseNumberList(profile.attributes.getNamedItem("ver").nodeValue);
    const cvs = parseNumberList(profile.getElementsByTagName("cvs")[0].textContent);

    let decoders = LocoDecoderProfiles.get(manufacturer);
    if (!decoders) {
        decoders = new Map<number, LocoDecoderProfile>();
        LocoDecoderProfiles.set(manufacturer, decoders);
    }

    for (const version of versions) {
        if (decoders.has(version)) throw new Error(`Duplicate decoder version encountered: version = ${version}, name = ${name}`);
        decoders.set(version, {
            name: name,
            cvs: cvs
        });
    }
}

let loaded = false;
export function loadData(cb: (error?: Error) => void) {
    // We should only need to load this once
    if (loaded) {
        cb();
        return;
    }

    const client = new XMLHttpRequest();
    client.onload = () => {
        try {
            if (client.status !== 200) {
                throw new Error(`Unexpected HTTP response, status = ${client.status}`);
            }
            // XML is used as we can annotate the data with comments which isn't an option with JSON
            parseData(client.responseXML);
            loaded = true;
            cb();
        }
        catch (error) {
            cb(error);
        }
    }
    client.onerror = () => {
        cb(new Error("Request failed"));
    }
    client.open("GET", "data/decoders.xml");
    client.send();
}