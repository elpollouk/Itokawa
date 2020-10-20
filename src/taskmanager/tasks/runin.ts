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
        ensureAddress(params.locoId);
        ensureSpeed(params.speed);
        return Promise.resolve(new RunInTask(id, params));
    }

    private _cancelled = false;

    constructor(id: number, params: RunInParams) {
        super(id, RunInTask.TASK_NAME);

        this._run(params.locoId, params.speed, params.seconds).finally(() => {
            // Stop the loco before flagging the task as finished
            this._setSpeed(params.locoId, 0);
        }).then(() => {
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

        // Run the loco forward
        await this._setSpeed(locoId, speed);
        while (count < seconds / 2) {
            await timeout(1);
            if (this._cancelled) return;
            count++;
            this._updateProgress(count, seconds);
        }

        // Run it in reverse
        await this._setSpeed(locoId, speed, true);
        while (count < seconds) {
            await timeout(1);
            if (this._cancelled) return;
            count++;
            this._updateProgress(count, seconds);
        }
    }

    protected _onCancel() {
        this._cancelled = true;
    }
}