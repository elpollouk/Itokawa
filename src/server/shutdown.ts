import { execAsync } from "../utils/exec";
import { application } from "../application";

const SHUTDOWN_COMMAND_KEY = "server.shutdown.command";
const SHUTDOWN_COMMAND = "sudo shutdown -h now";

export async function execShutdown(): Promise<void> {
    const command = application.config.get(SHUTDOWN_COMMAND_KEY, SHUTDOWN_COMMAND);
    await execAsync(command as string);
}