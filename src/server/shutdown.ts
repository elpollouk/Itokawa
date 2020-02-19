import { execAsync } from "../utils/exec";
import { application } from "../application";

const SHUTDOWN_COMMAND = "sudo shutdown -h now";
const RESTART_COMMAND = "sudo shutdown -r now";

export async function shutdownCheck() {
    const command = application.config.get("server.commands.shutdown");
    if (!command && process.platform != "linux") {
        throw new Error(`Shutdown not configured for ${process.platform}`);
    }
}

export async function restartCheck() {
    const command = application.config.get("server.commands.restart");
    if (!command && process.platform != "linux") {
        throw new Error(`Restart not configured for ${process.platform}`);
    }
}

export async function execShutdown(): Promise<void> {
    const command = application.config.get("server.commands.shutdown", SHUTDOWN_COMMAND);
    await execAsync(command as string);
}

export async function execRestart(): Promise<void> {
    const command = application.config.get("server.commands.restart", RESTART_COMMAND);
    await execAsync(command as string);
}