import * as SerialPort from "serialport";
import { Logger } from "../utils/logger";
import { toHumanHex } from "../utils/hex";

let log = new Logger("Serial");

function _nullUpdate() {}

export class AsyncSerialPort {
    static open(path: string, options: SerialPort.OpenOptions): Promise<AsyncSerialPort> {
        log.debug(`Opening ${path} with options ${JSON.stringify(options)}`);
        return new Promise<AsyncSerialPort>((resolve, reject) => {
            let port = new SerialPort(path, options, (err) => {
                if (err == null) resolve(new AsyncSerialPort(port));
                else reject(err);
            });
        });
    }

    private _buffer: number[] = [];
    private _updateReader: () => void = _nullUpdate;

    get bytesAvailable(): number {
        return this._buffer.length;
    }

    private constructor(private _port:SerialPort) {
        this._port.on('data', (data: Buffer) => {
            log.debug(`Received: ${toHumanHex(data)}`);
            for (let i = 0; i < data.length; i++)
                this._buffer.push(data[i]);

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
        if (this._updateReader != _nullUpdate) throw new Error("Read already in progress");

        return new Promise<number[]>((resolve, reject) => {
            this._updateReader = () => {
                if (this._buffer.length >= size) {
                    this._updateReader = _nullUpdate;
                    resolve(this._buffer.splice(0, size));
                }
            };
            this._updateReader();
        });
    }

    async concatRead(data: number[], size: number): Promise<number[]> {
        return data.concat(await this.read(size));
    }

    close(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._port.close((err) => {
                if (err) reject(err);
                this._port = null;
                resolve();
            });
        });
    }
}