import * as express from "express";
import { application } from "../../application";
import * as fs from "fs";

const _router = express.Router();
_router.route("/")
.get(async (_, res) => {
    const backups: string[] = [];

    const backupDir = application.getDataPath("backups");
    if (fs.existsSync(backupDir)) {
        const files = await fs.promises.readdir(backupDir);
        for (const file of files) {
            if (file.endsWith(".zip")) backups.push(file);
        }
    }

    res.render("backup/index", {
        backups: backups
    });
});

export async function getRouter(): Promise<express.Router> {
    return _router;
}