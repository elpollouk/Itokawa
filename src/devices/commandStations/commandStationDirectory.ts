import { PortInfo } from "serialport";
import { ELinkCommandStation } from "./elink";
import { MockCommandStation } from "./commandStation.mock";
import { ICommandStationConstructable } from "./commandStation";

const deviceMap = new Map<string, ICommandStationConstructable[]>([
    ["Microchip Technology, Inc.", [ELinkCommandStation]],
    ["Microchip Technology Inc.", [ELinkCommandStation]],
    ["__TEST__", [MockCommandStation]]
]);

export function detectCommandStation(port: PortInfo): ICommandStationConstructable[] {
    return deviceMap.get(port.manufacturer) || [];
}