import { execAsync } from "../utils/exec";
import { application } from "../application";

const SHUTDOWN_COMMAND = "sudo shutdown -h now";
const RESTART_COMMAND = "sudo shutdown -r now";

export async function execShutdown(): Promise<void> {
    const command = application.config.get("server.commands.shutdown", SHUTDOWN_COMMAND);
    await execAsync(command as string);
}

export async function execRestart(): Promise<void> {
    const command = application.config.get("server.commands.restart", RESTART_COMMAND);
    await execAsync(command as string);
}