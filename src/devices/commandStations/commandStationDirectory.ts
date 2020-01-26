import { PortInfo } from "serialport";
import { ELink } from "./elink";
import { MockCommandStation } from "./commandStation.mock";

let deviceMap = {
    "Microchip Technology, Inc.": [ELink],
    "Microchip Technology Inc.": [ELink],
    "__TEST__": [MockCommandStation]
}

export function detectCommandStation(port: PortInfo): any {
    return (port.manufacturer in deviceMap) ? deviceMap[port.manufacturer] : [];
}