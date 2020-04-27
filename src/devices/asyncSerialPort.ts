import { EventEmitter } from "events";
import * as SerialPort from "serialport";
import { Logger } from "../utils/logger";
import { toHumanHex } from "../utils/hex";
import { DebugSnapshot } from "../utils/debugSnapshot";
import { application } from "../application";

let log = new Logger("Serial");

function _nullUpdate() {}

export class AsyncSerialPort extends EventEmitter {
    static open(path: string, options: SerialPort.OpenOptions): Promise<AsyncSerialPort> {
        log.debug(() => `Opening ${path} with options ${JSON.stringify(options)}`);
        return new Promise<AsyncSerialPort>((resolve, reject) => {
            let port = new SerialPort(path, options, (err) => {
                if (err) reject(err);
                else resolve(new AsyncSerialPort(port));
            });
        });
    }

    private _closeRequested = false;
    private _buffer: number[] = [];
    private _updateReader: () => void = _nullUpdate;
    private _debugSnapshot: DebugSnapshot = null;

    get bytesAvailable(): number {
        return this._buffer.length;
    }

    private constructor(private _port:SerialPort) {
        super();

        if (application.config.has("debug.serialport")) {
            const size = application.config.getAs("debug.serialport.snapshotsize", 10);
            log.info(() => `Enabling debug snap shots, size = ${size}`);
            this._debugSnapshot = new DebugSnapshot(size, (data) => {
                return `${data[0]}: ${toHumanHex(data[1])}`;
            });
        }

        this._port.on("data", (data: Buffer) => {
            log.debug(() => `Received: ${toHumanHex(data)}`);
            if (this._debugSnapshot) this._debugSnapshot.add("Recv", data);
            for (let i = 0; i < data.length; i++)
                this._buffer.push(data[i]);

            this.emit("data", data);
            this._updateReader();
        });
        this._port.on("close", () => {
            if (!this._closeRequested) {
                log.warning("Serial port closed");
                this.emit("error", new Error("Unexpected serial port close event"));
            }
        });
        this._port.on("error", (err) => {
            log.warning(`Serial port error: ${err}`);
            this.emit("error", err);
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
            
            if (this._debugSnapshot) this._debugSnapshot.add("Sent", data);
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
        this._closeRequested = true;
        return new Promise((resolve, reject) => {
            this._port.close((err) => {
                if (err) reject(err);
                this._port = null;
                resolve();
            });
        });
    }

    saveDebugSanpshot() {
        if (this._debugSnapshot) {
            const path = application.getDataPath("serialport.snapshot.txt");
            log.info(() => `Saving debug snap shot to ${path}`);
            this._debugSnapshot.save(path);
        }
    }
}