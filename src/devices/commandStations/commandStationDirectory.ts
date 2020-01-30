import { DeviceEnumerator } from "../deviceEnumerator";
import { ELinkCommandStation } from "./elink";
import { NullCommandStation } from "./null";

export function registerCommandStations() {

    DeviceEnumerator.registerDevice(ELinkCommandStation, "Microchip Technology, Inc.",
                                                         "Microchip Technology Inc.");

    DeviceEnumerator.registerDevice(NullCommandStation, "__TEST__");

}

