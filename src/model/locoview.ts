import { Database } from "./database";
import { Statement } from "./statement";

let _getViewIdQuery: Statement;
let _hasQuery: Statement;
let _allLocosQuery: Statement<number>;
let _addLocoQuery: Statement;
let _removeLocoQuery: Statement;

async function _getLocoIds(viewId: number): Promise<Set<number>> {
    const locoIds = await _allLocosQuery.all({
        $viewId: viewId
    }, (row) => row.locoId)

    return new Set(locoIds);
}

export class LocoView {
    static async init(db: Database) {
        _getViewIdQuery = await db.prepare("SELECT id FROM loco_views WHERE name = $name;");
        _hasQuery = await db.prepare("SELECT 1 FROM loco_view_mapping WHERE viewId = $viewId AND locoId = $locoId;");
        _allLocosQuery = await db.prepare("SELECT locoId FROM loco_view_mapping WHERE viewId = $viewId;");
        _addLocoQuery = await db.prepare("INSERT OR IGNORE INTO loco_view_mapping(viewId, locoId) VALUES ($viewId, $locoId);");
        _removeLocoQuery = await db.prepare("DELETE FROM loco_view_mapping WHERE viewId = $viewId AND locoId = $locoId;");
    }

    static async release() {
        if (_getViewIdQuery) {
            await _getViewIdQuery.release();
            _getViewIdQuery = null;
        }
        if (_hasQuery) {
            await _hasQuery.release();
            _hasQuery = null;
        }
        if (_allLocosQuery) {
            await _allLocosQuery.release();
            _allLocosQuery = null;
        }
        if (_addLocoQuery) {
            await _addLocoQuery.release();
            _addLocoQuery = null;
        }
        if (_removeLocoQuery) {
            await _removeLocoQuery.release();
            _removeLocoQuery = null;
        }
    }

    static async getView(viewName: string): Promise<LocoView> {
        const result = await _getViewIdQuery.get({
            $name: viewName
        });

        if (!result) throw new Error("View not found");
        return new LocoView(viewName, result.id);
    }

    private constructor(public readonly viewName: string, private readonly _viewId: number) {

    }

    public get locoIds(): Promise<Set<number>> {
        return _getLocoIds(this._viewId);
    }

    public async hasLoco(id: number): Promise<boolean> {
        const result = await _hasQuery.get({
            $viewId: this._viewId,
            $locoId: id
        });

        return !!result;
    }

    public addLoco(id: number): Promise<void> {
        return _addLocoQuery.run({
            $viewId: this._viewId,
            $locoId: id
        });
    }

    public removeLoco(id: number): Promise<void> {
        return _removeLocoQuery.run({
            $viewId: this._viewId,
            $locoId: id
        });
    }
}
