import { DeviceEnumerator } from "../deviceEnumerator";
import { ELinkCommandStation } from "./elink";
import { NullCommandStation } from "./null";
import { RawCommandStation } from "./raw";

export function registerCommandStations() {

    DeviceEnumerator.registerDevice(ELinkCommandStation, "Microchip Technology, Inc.",
                                                         "Microchip Technology Inc.");

    DeviceEnumerator.registerDevice(NullCommandStation, "__TEST__");
    DeviceEnumerator.registerDevice(RawCommandStation);
}

