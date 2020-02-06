import * as ngrok from "ngrok";
import { ConfigNode } from "../utils/config";

export async function publish(port: number, config?: ConfigNode): Promise<string> {
    let options: ngrok.INgrokOptions = {
        addr: port
    };

    if (config) options = { ...options, ...config };

    return ngrok.connect(options);
}