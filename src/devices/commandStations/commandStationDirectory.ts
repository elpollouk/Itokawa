import { PortInfo } from "serialport";
import { ELink } from "./elink";
import { MockCommandStation } from "./commandStation.mock";
import { ICommandStationConstructable } from "./commandStation";

const deviceMap = new Map<string, ICommandStationConstructable[]>([
    ["Microchip Technology, Inc.", [ELink]],
    ["Microchip Technology Inc.", [ELink]],
    ["__TEST__", [MockCommandStation]]
]);

export function detectCommandStation(port: PortInfo): ICommandStationConstructable[] {
    return deviceMap.get(port.manufacturer) || [];
}