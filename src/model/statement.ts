import * as sqlite3 from "sqlite3";

export class Statement<ResultType=any> {
    constructor(private _statement: sqlite3.Statement) {

    }

    get(params?: any, transform?:(row:any)=>ResultType): Promise<ResultType> {
        if (!transform) transform = (row) => row;
        return new Promise<ResultType>((resolve, reject) => {
            this._statement.get(params, (err, row) => {
                if (err) {
                    reject(err);
                }
                else {
                    this._statement.reset();
                    const result = transform(row);
                    resolve(result);
                }
            });
        });
    }

    all(params?: any, transform?:(row:any)=>ResultType): Promise<ResultType[]> {
        if (!transform) transform = (row) => row;
        return new Promise<ResultType[]>((resolve, reject) => {
            const results: ResultType[] = [];
            this._statement.each(params, (err, row) => {
                if (err) {
                    reject(err);
                }
                else {
                    const result = transform(row);
                    results.push(result);
                }
            }, (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(results);
                }
            });
        });
    }

    run(params?: any, transform?:(result:sqlite3.RunResult)=>ResultType): Promise<ResultType> {
        if (!transform) transform = () => null;
        return new Promise<ResultType>((resolve, reject) => {
            this._statement.run(params, function (err) {
                if (err) {
                    reject(err);
                }
                else {
                    const result = transform(this);
                    resolve(result);
                }
            });
        });
    }

    release(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._statement.finalize((err) => {
                if (err) {
                    reject(err);
                }
                else {
                    this._statement = null;
                    resolve();
                }
            });
        });
    }
}
