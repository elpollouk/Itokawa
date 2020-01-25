import * as SerialPort from "serialport";
import { Logger } from "../utils/logger";
import { toHumanHex } from "../utils/hex";

let log = new Logger("Serial");

export class AsyncSerialPort {
    static open(path: string, options: SerialPort.OpenOptions): Promise<AsyncSerialPort> {
        log.debug(`Opening ${path} with options ${JSON.stringify(options)}`);
        return new Promise<AsyncSerialPort>((resolve, reject) => {
            let port = new SerialPort(path, options, (err) => {
                if (err == null) {
                    resolve(new AsyncSerialPort(port));
                }
                else {
                    reject(err);
                }
            });
        });
    }

    private _buffer: number[] = [];
    private _updateReader: () => void = null;

    get bytesAvailable(): number {
        return this._buffer.length;
    }

    private constructor(private _port:SerialPort) {
        this._port.on('data', (data: Buffer) => {
            log.debug(`Received: ${toHumanHex(data)}`);
            for (let i = 0; i < data.length; i++)
                this._buffer.push(data[i]);

            if (this._updateReader)
                this._updateReader();
        });
    }

    write(data: Buffer | number[]): Promise<void> {
        log.debug(`Writing: ${toHumanHex(data)}`);
        return new Promise((resolve, reject) => {
            this._port.write(data);
            this._port.drain((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    read(size: number): Promise<number[]> {
        if (this._updateReader) throw new Error("Read already in progress");

        return new Promise<number[]>((resolve, reject) => {
            this._updateReader = () => {
                if (this._buffer.length >= size) {
                    this._updateReader = null;
                    resolve(this._buffer.splice(0, size));
                }
            };
            this._updateReader();
        });
    }

    close() {
        this._port.close();
        this._port = null;
    }
}