import { DeviceEnumerator } from "../deviceEnumerator";
import { ELinkCommandStation } from "./elink";
import { MockCommandStation } from "./commandStation.mock";

export function registerCommandStations() {

    DeviceEnumerator.registerDevice(ELinkCommandStation, "Microchip Technology, Inc.",
                                                         "Microchip Technology Inc.");

    DeviceEnumerator.registerDevice(MockCommandStation, "__TEST__");

}

