import { DeviceEnumerator } from "../deviceEnumerator";
import { ELinkCommandStation } from "./elink";
import { MockCommandStation } from "./commandStation.mock";
import { NullCommandStation } from "./null";

export function registerCommandStations() {

    DeviceEnumerator.registerDevice(ELinkCommandStation, "Microchip Technology, Inc.",
                                                         "Microchip Technology Inc.");

    DeviceEnumerator.registerDevice(MockCommandStation, "__TEST__");
    DeviceEnumerator.registerDevice(NullCommandStation);

}

