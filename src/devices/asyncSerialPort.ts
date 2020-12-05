import { EventEmitter } from "events";
import * as SerialPort from "serialport";
import { Logger } from "../utils/logger";
import { toHumanHex } from "../utils/hex";
import { DebugSnapshot } from "../utils/debugSnapshot";
import { application } from "../application";

const log = new Logger("Serial");
let _debugSnapshot: DebugSnapshot = null;

function _nullUpdate() {}

function _snapshotAdd(...data: any[]) {
    if (_debugSnapshot) _debugSnapshot.add(...data);
}

export class AsyncSerialPort extends EventEmitter {
    
    // This is for clearing out the log during testing
    static _disableDebugSnapshot() {
        _debugSnapshot = null;
    }

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
    private _rejects = new Set<(err: Error)=>void>();

    get bytesAvailable(): number {
        return this._buffer.length;
    }

    private constructor(private _port: SerialPort) {
        super();

        if (application.config.has("debug.serialport") && !_debugSnapshot) {
            const size = application.config.getAs("debug.serialport.snapshotsize", 10);
            log.info(() => `Enabling debug snap shots, size=${size}`);
            _debugSnapshot = new DebugSnapshot(size, (data) => {
                const dataString = typeof(data[1]) === "string" ? data[1] : toHumanHex(data[1]);
                return `${data[0]}: ${dataString}`;
            });
        }
        _snapshotAdd("Open", _port.path);

        this._port.on("data", (data: Buffer) => {
            log.debug(() => `Received: ${toHumanHex(data)}`);
            _snapshotAdd("Recv", data);
            for (let i = 0; i < data.length; i++)
                this._buffer.push(data[i]);

            this.emit("data", data);
            this._updateReader();
        });
        this._port.on("close", () => {
            this._rejectOutstandingPromises(new Error("Port closed"));
            if (!this._closeRequested) {
                log.warning("Serial port closed");
                this.emit("error", new Error("Unexpected serial port close event"));
            }
        });
        this._port.on("error", (err) => {
            log.warning(`Serial port error: ${err}`);
            this._rejectOutstandingPromises(err);
            this.emit("error", err);
        });
    }

    private _rejectOutstandingPromises(error: Error) {
        log.debug(() => `Rejecting ${this._rejects.size} outstanding promises`);
        for (const reject of this._rejects)
            reject(error);
        this._rejects.clear();
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
            
            _snapshotAdd("Sent", data);
            this._port.write(data, writeCallback);
        });
    }

    read(size: number, timeoutSeconds?: number): Promise<number[]> {
        if (this._updateReader != _nullUpdate) return Promise.reject(new Error("Read already in progress"));

        return new Promise<number[]>((resolve, reject) => {
            this._rejects.add(reject);

            let timeoutToken = null;
            if (timeoutSeconds) {
                timeoutToken = setTimeout(() => {
                    this._updateReader = _nullUpdate;
                    this._rejects.delete(reject);
                    resolve(null);
                }, timeoutSeconds * 1000);
            }
            this._updateReader = () => {
                if (this._buffer.length >= size) {
                    this._updateReader = _nullUpdate;
                    clearTimeout(timeoutToken);
                    this._rejects.delete(reject);
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
            if (!this._port) {
                resolve();
                return;
            }
            
            _snapshotAdd("Close", this._port.path);
            this._port.close((err) => {
                if (err) reject(err);
                this._port = null;
                resolve();
            });
        });
    }

    saveDebugSanpshot() {
        if (_debugSnapshot) {
            const path = application.getDataPath("serialport.snapshot.txt");
            log.info(() => `Saving debug snap shot to ${path}`);
            _debugSnapshot.save(path);
        }
    }
}