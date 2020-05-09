function enusureValidFlag(flag: string) {
    if (!flag || typeof(flag) !== "string")
        throw new Error(`Invalid flag name, "${flag}" is not a valid string`);
}

export class FeatureFlags {
    private readonly _flags = new Set<string>();

    set(flag: string | string[]) {
        if (Array.isArray(flag)) {
            for (const f of flag)
                this.set(f);
        }
        else {
            enusureValidFlag(flag);
            this._flags.add(flag);
        }
    }

    isSet(flag: string) {
        enusureValidFlag(flag);
        return this._flags.has(flag);
    }

    getFlags() {
        return this._flags.values();
    }
}