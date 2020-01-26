import * as SerialPort from "serialport";
import { Logger } from "../utils/logger";
import { toHumanHex } from "../utils/hex";

let log = new Logger("Serial");

function _nullUpdate() {}

export class AsyncSerialPort {
    static open(path: string, options: SerialPort.OpenOptions): Promise<AsyncSerialPort> {
        log.debug(() => `Opening ${path} with options ${JSON.stringify(options)}`);
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
            log.debug(() => `Received: ${toHumanHex(data)}`);
            for (let i = 0; i < data.length; i++)
                this._buffer.push(data[i]);

            this._updateReader();
        });
        this._port.on('error', (err) => {
            // We need to register an explicit error handler as the serialport library will try to
            // emit error events even if we're registered handlers at the call level. The events
            // library automatically re-throws errors if no error handler is registered.
            log.warning(`Serial port error: ${err}`);
        });
    }

    write(data: Buffer | number[]): Promise<void> {
        log.debug(() => `Writing: ${toHumanHex(data)}`);

        return new Promise((resolve, reject) => {
            let writeCallback = (err: Error, bytesWritten: number) => {
                if (err) reject(err);
                else this._port.drain((err) => {
                    if (err) reject(err);
                    else resolve();

                    // TODO - Handle partial writes
                });
            }
            
            this._port.write(data, writeCallback);
        });
    }

    read(size: number): Promise<number[]> {
        if (this._updateReader != _nullUpdate) return Promise.reject(new Error("Read already in progress"));

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