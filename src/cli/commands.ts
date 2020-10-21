import { Logger, LogLevel } from "../utils/logger";
import { execCommand, CommandContext, error } from "./executor"
import { timeout } from "../utils/promiseUtils";
import * as fs from "fs";
import { fromHex, toHumanHex } from "../utils/hex";
import { application } from "../application";
import { FunctionAction } from "../devices/commandStations/commandStation";
import { RunInParams, RunInTask } from "../taskmanager/tasks/runin";
import { ITask, TaskProgress } from "../taskmanager/taskmanager";

// Maintain a list of locos we've sent commands to for the 'estop' command
const _seenLocos = new Set<number>();

function resolveLocoAddress(context: CommandContext, locoId: string): number {
    let address = parseInt(locoId);
    if (isNaN(address)) error(`'${locoId}' is not a valid loco id`);
    if (address < 1 || address > 9999) error(`'${locoId}' is not a valid loco id`)

    _seenLocos.add(address);

    return address;
}

function resolveSpeed(context: CommandContext, speedStr: string): number {
    let speed = parseInt(speedStr);
    if (isNaN(speed)) error(`'${speedStr}' is not a valid speed value`);
    if (speed < 0 || speed > 127) error(`'${speedStr}' is not a valid speed value`);
    return speed;
}

function resolveFunction(context: CommandContext, funcStr: string): number {
    let func = parseInt(funcStr);
    if (isNaN(func)) error(`'${funcStr}' is not a valid function`);
    if (func < 0 || func > 28) error(`'${funcStr}' is not a valid function`);
    return func;
}

function resolveFunctionAction(context: CommandContext, request: string): FunctionAction {
    request = request || "";
    request = request.toLocaleLowerCase();
    switch (request) {
        case "off":
            return FunctionAction.LATCH_OFF;
        case "on":
            return FunctionAction.LATCH_ON;
        default:
            return FunctionAction.TRIGGER;
    }
}

//-----------------------------------------------------------------------------------------------//
// Exported commands
// Please keep them in alphabetical order
//-----------------------------------------------------------------------------------------------//

// Echo
export async function echo(context: CommandContext, args: string[]) {
    const message = args.join(" ");
    context.out(message);
}
echo.minArgs = 1;
echo.help = "Echo args back to the output."

// Emergency stop
export async function estop(context: CommandContext, args?: string[]) {
    if (_seenLocos.size == 0) error("No locos have received commands yet.");

    const batch = await application.commandStation.beginCommandBatch();
    for (const address of _seenLocos) {
        batch.setLocomotiveSpeed(address, 0);
    }
    await batch.commit();
}
estop.help = "Emergency stop all locos which have received commands this session."

// Execute a script
export function exec(context: CommandContext, args: string[]) {
    return new Promise<void>(async (resolve, reject) => {
        fs.readFile(args[0], async (err, data) => {
            if (err) {
                reject(err);
                return;
            }

            try {
                const script = data.toString().split("\n");
                for (const line of script)
                    await execCommand(context, line, true);

                resolve();
            }
            catch (ex) {
                reject(ex);
            }
        });
    });
}
exec.minArgs = 1;
exec.maxArgs = 1;
exec.help = "Execute a script.\n  Usage: exec SCRIPT_PATH"

// Exit
export async function exit(context: CommandContext, args?: string[]) {
    await application.shutdown();
}
exit.maxArgs = 0;
exit.help = "Exits this application";

function parseCvNumber(context: CommandContext, value: string) {
    const cv = parseInt(value);
    if (isNaN(cv) || cv < 1 || cv > 255) error(`${value} is not a valid CV number`);
    return cv;
}

function parseByte(context: CommandContext, value: string) {
    const byte = parseInt(value);
    if (isNaN(byte) || byte < 0 || byte > 255) error(`${value} is not a valid byte value`);
    return byte;
}

// Read Loco CV
export async function loco_cv_read(context: CommandContext, args: string[]) {
    let cv = parseCvNumber(context, args[0]);
    const cvEnd = args[1] ? parseCvNumber(context, args[1]) : cv;

    while (cv <= cvEnd) {
        const value = await application.commandStation.readLocoCv(cv);
        if (value !== 0 || args.length === 1) context.out(`CV ${cv}: ${value} (0x${toHumanHex([value])})`);
        cv++;
    }
}
loco_cv_read.minArgs = 1;
loco_cv_read.maxArgs = 2;
loco_cv_read.help = "Read locomotive CV value.\n  Usage: loco_cv_read CV_NUMBER [END_CV_NUMBER]";

// Write Loco CV
export async function loco_cv_write(context: CommandContext, args: string[]) {
    const cv = parseCvNumber(context, args[0]);
    const value = parseByte(context, args[1]);
    await application.commandStation.writeLocoCv(cv, value);
}
loco_cv_write.minArgs = 2;
loco_cv_write.maxArgs = 2;
loco_cv_write.help = "Write locomotive CV value.\n  Usage: loco_cv_write CV_NUMBER CV_VALUE";

// Loco Function Control
export async function loco_function(context: CommandContext, args: string[]) {
    let action = resolveFunctionAction(context, args[2]);
    let func = resolveFunction(context, args[1]);
    let address = resolveLocoAddress(context, args[0]);

    const batch = await application.commandStation.beginCommandBatch();
    batch.setLocomotiveFunction(address, func, action);
    await batch.commit();
}
loco_function.minArgs = 2;
loco_function.maxArgs = 3;
loco_function.help = "Set locomotive function.\n  Usage: loco_function LOCO_ID FUNCTION [on|off]";

// Loco Speed Control
export async function loco_speed(context: CommandContext, args: string[]) {
    let reverse = args[2] == "R" || args[2] == "r";
    let speed = resolveSpeed(context, args[1]);
    let address = resolveLocoAddress(context, args[0]);

    const batch = await application.commandStation.beginCommandBatch();
    batch.setLocomotiveSpeed(address, speed, reverse);
    await batch.commit();
}
loco_speed.minArgs = 2;
loco_speed.maxArgs = 3;
loco_speed.help = "Set locomotive's speed.\n  Usage: loco_speed LOCO_ID SPEED [F|R]";

// Log level
export async function loglevel(context: CommandContext, args: string[]) {
    if (args.length == 0) {
        context.out(LogLevel[Logger.logLevel]);
        return;
    }

    const newLevel = args[0].toUpperCase();
    if (!(newLevel in LogLevel)) error(`${newLevel} isn't a recognised log level`);

    Logger.logLevel = LogLevel[newLevel];
}
loglevel.minArgs = 0;
loglevel.maxArgs = 1;
loglevel.help = "Sets the application log level.\n  Usage: loglevel [NONE|ERROR|WARNING|DISPLAY|INFO|DEBUG]";

// Write raw data as part of a command batch
export async function raw_command(context: CommandContext, args: string[]) {
    const hex = args.join("");
    const data = fromHex(hex);
    const batch = await application.commandStation.beginCommandBatch();
    batch.writeRaw(data);
    await batch.commit();
}
raw_command.minArgs = 1;
raw_command.help = "Write raw bytes as a command batch\n  Udate: raw_command HEX_DATA";

// Write raw data directly to the command station
export async function raw_write(context: CommandContext, args: string[]) {
    const hex = args.join("");
    const data = fromHex(hex);
    await application.commandStation.writeRaw(data);
}
raw_write.minArgs = 1;
raw_write.help = "Write raw bytes to the command station\n  Udate: raw_write HEX_DATA";

// Sleep
export async function sleep(context: CommandContext, args: string[]) {
    const time = parseFloat(args[0]);
    if (isNaN(time)) error(`'${args[0]}' is not a valid sleep duration`);

    await timeout(time);
}
sleep.minArgs = 1;
sleep.maxArgs = 1;
sleep.help = "Pause the CLI for the specified number of seconds.\n  Usage: sleep SECONDS";


//-----------------------------------------------------------------------------------------------//
// Tasks
//-----------------------------------------------------------------------------------------------//

// List running tasks
function formatTaskProgress(progress: TaskProgress): string {
    let text = "";

    if (progress.progress !== undefined && progress.progressTarget !== undefined) {
        const percent = Math.floor(100 * progress.progress / progress.progressTarget);
        text += `${progress.progress}/${progress.progressTarget} (${percent}%)`;
    }
    else if (progress.progress !== undefined) {
        text += `${progress.progress}`;
    }

    if (progress.status) {
        if (text) text += " - ";
        text += progress.status;
    }

    return text;
}

export async function task_list(context: CommandContext, args: string[]) {
    context.out("Running tasks:");
    for (const task of application.taskmanager.listTasks()) {
        const info = formatTaskProgress(task.progress);
        if (info) {
            context.out(`  ${task.id} ${task.name} - ${info}`);
        }
        else {
            context.out(`  ${task.id} ${task.name}`);
        }
    }
}
task_list.maxArgs = 0;
task_list.help = "List running background tasks\n  Usage: task_list";

// Cancel a background task
export async function task_cancel(context: CommandContext, args: string[]) {
    const id = parseInt(args[0]);
    if (isNaN(id)) error(`'${args[0]}' is not a valid task id`);

    context.out(`Cancelling task ${id}...`);
    await application.taskmanager.getTask(id).cancel();
}
task_cancel.minArgs = 1;
task_cancel.maxArgs = 1;
task_cancel.help = "Cancel a background task\n  Usage: task_cancel TASK_ID";

// Run in cycle
export async function runin(context: CommandContext, args: string[]) {
    const locoId = resolveLocoAddress(context, args[0]);
    const seconds = parseFloat(args[1]);
    if (isNaN(seconds)) error(`'${args[1]}' is not a valid time duration`);

    const task = await application.taskmanager.startTask<RunInParams>(RunInTask.TASK_NAME, {
        locoId: locoId,
        speed: 64,
        seconds: seconds
    });

    // Store the task id in the context for potential future use
    context.vars["_TASKID"] = task.id;
    context.out(`Task ${task.id} started...`);
    task.subscribe((progress) => {
        if (!progress.finished) return;
        context.out(`Task ${task.id} finished`);
    });
}
runin.minArgs = 2;
runin.maxArgs = 2;
runin.help = "Run in a locomotive\n  Usage: runin LOCO_ID SECONDS";
