export class LocoView {
    private _locoIds = new Set<number>();

    public constructor(public readonly viewName: string) {

    }

    private *_locoIdsGenerator(): IterableIterator<number> {
        for (const id of this._locoIds) {
            yield id;
        }
    }

    public get locoIds(): Promise<IterableIterator<number>> {
        return Promise.resolve(this._locoIdsGenerator());
    }

    public hasLoco(id: number): Promise<boolean> {
        return Promise.resolve(this._locoIds.has(id));
    }

    public addLoco(id: number): Promise<void> {
        this._locoIds.add(id);
        return Promise.resolve();
    }

    public removeLoco(id: number): Promise<void> {
        this._locoIds.delete(id);
        return Promise.resolve();
    }
}
