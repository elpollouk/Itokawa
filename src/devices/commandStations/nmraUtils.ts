import { CommandStationError } from "./commandStation";

export function encodeLongAddress(address: number, buffer: number[] | Buffer, offset?: number) {
    offset = offset || 0;

    if (address < 100 || address > 9999) throw new CommandStationError(`Invalid long address, address=${address}`);
    if (offset < 0 || offset > buffer.length - 2) throw new CommandStationError(`Attempt to write outside of range of buffer, offset=${offset}, buffer size=${buffer.length}`)

    address |= 0xC000;
    buffer[offset + 0] = address >> 8;
    buffer[offset + 1] = address & 0xFF;
}

export function decodeLongAddress(buffer: number[] | Buffer, offset?: number): number {
    offset = offset || 0;

    const upper = buffer[offset]
    if ((upper & 0xC0) == 0xC0) {
        return ((upper & 0x3F) << 8) | buffer[offset + 1];
    }
    else {
        return buffer[offset + 1];
    }
}

export function ensureWithinRange(value: number, minValue: number, maxValue: number, valueName: string) {
    if (value < minValue || value > maxValue) throw new Error(`${valueName} outside of valid range`);
}

export function ensureCvNumber(cv: number) {
    ensureWithinRange(cv, 1, 255, `CV ${cv}`);
}

export function ensureByte(value: number) {
    ensureWithinRange(value, 0, 255, `Byte(${value})`);
}
