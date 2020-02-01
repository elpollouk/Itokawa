import { CommandStationError } from "./commandStation";

export function encodeLongAddress(address: number, buffer: number[] | Buffer, offset?: number) {
    offset = offset || 0;

    if (address < 100 || address > 9999) throw new CommandStationError(`Invalid long address, address=${address}`);
    if (offset < 0 || offset > buffer.length - 2) throw new CommandStationError(`Attempt to write outside of range of buffer, offset=${offset}, buffer size=${buffer.length}`)

    address |= 0xC000;
    buffer[offset + 0] = address >> 8;
    buffer[offset + 1] = address & 0xFF;
}