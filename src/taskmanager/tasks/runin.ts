import { TaskBase } from "../taskmanager";
import { application } from "../../application";
import { timeout } from "../../utils/promiseUtils";
import { ensureAddress, ensureSpeed } from "../../devices/commandStations/nmraUtils";

export interface RunInParams {
    locoId: number;
    speed: number;
    seconds: number;
}

export class RunInTask extends TaskBase {
    static readonly TASK_NAME = "RunIn";

    static factory(id: number, params: RunInParams) {
        try {
            ensureAddress(params.locoId);
            ensureSpeed(params.speed);
            if (params.seconds <= 0) throw new Error(`${params.seconds} is in valid time value`);
            return Promise.resolve(new RunInTask(id, params));
        }
        catch (error) {
            return Promise.reject(error);
        }
    }

    private _cancelled = false;

    constructor(id: number, params: RunInParams) {
        super(id, RunInTask.TASK_NAME);

        this._run(params.locoId, params.speed, params.seconds).then(() => {
            this._onProgress({
                id: this.id,
                finished: true
            })
        }, (error) => {
            this._fail(error.message);
        });
    }

    private _updateProgress(count: number, target: number) {
        this._onProgress({
            id: this.id,
            finished: false,
            progress: count,
            progressTarget: target
        });
    }

    private async _setSpeed(locoId: number, speed: number, reverse?: boolean) {
        const batch = await application.commandStation.beginCommandBatch();
        batch.setLocomotiveSpeed(locoId, speed, reverse);
        await batch.commit();
    }

    private async _run(locoId: number, speed: number, seconds: number) {
        let count = 0;
        this._updateProgress(count, seconds);

        // We need two loops, one loop to run forwards and a second loop to run backwards
        let reverse = false;
        for (let i = 0; i < 2 && !this._cancelled; i++) {
            await this._setSpeed(locoId, speed, reverse);

            for (let j = 0; j < seconds / 2 && !this._cancelled; j++) {
                await timeout(1);
                this._updateProgress(++count, seconds);
            }

            reverse = !reverse;
        }

        await this._setSpeed(locoId, 0);
    }

    protected _onCancel() {
        this._cancelled = true;
    }
}