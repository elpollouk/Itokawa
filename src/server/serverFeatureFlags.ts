import { FeatureFlags } from "../common/featureFlags";
import { ConfigNode } from "../utils/config";

export class ServerFeatureFlags extends FeatureFlags {
    setFromConfig(config: ConfigNode) {
        if (!(config instanceof ConfigNode)) throw new Error("No config provided");

        for (const flag of config.keys())
            this.set(flag);
    }

    setFromCommandLine(flags: string) {
        if (!flags || typeof(flags) !== "string")
            throw new Error(`Invalid flag definitions, "${flags}"`);

        for (const flag of flags.split(/[\s\,]/))
            if (flag)
                this.set(flag);
    }
}