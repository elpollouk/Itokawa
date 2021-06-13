import * as express from "express";
import { application } from "../../application";
import * as fs from "fs";
import { requirePermission } from "./authRouter";
import { Permissions } from "../sessionmanager";
import { PATH_BACKUP } from "../../common/constants";
import * as backup from "../../utils/backup";

const _router = express.Router();
_router.use(requirePermission(Permissions.SERVER_BACKUP))

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

_router.route("/createBackup")
.get(async (_, res) => {
    try {
        const backupFile = await backup.createBackup(
            application.database,
            application.getDataPath(),
            application.getDataPath("backups")
        );

        res.render("result", {
            message: `${backupFile} created.`,
            okLink: PATH_BACKUP
        });
    }
    catch (err) {
        res.render("result", {
            errorMessage: err,
            okLink: PATH_BACKUP
        });
    }
});

_router.route("/deleteBackup/:backup")
.get(async (req, res) => {
    try {
        const backup = req.params.backup;
        if (!backup.match(/^[\w\.]+\.zip$/)) throw new Error("Invalid backup");

        const backupDir = application.getDataPath("backups");
        const backupFile = `${backupDir}/${backup}`
        if (fs.existsSync(backupFile)) {
            await fs.promises.unlink(backupFile);
        }

        res.render("result", {
            message: "Backup deleted.",
            okLink: PATH_BACKUP
        });
    }
    catch (err) {
        res.render("result", {
            errorMessage: err,
            okLink: PATH_BACKUP
        });
    }
});

_router.route("/restoreBackup/:backup")
.get(async (req, res) => {
    try {
        const backup = req.params.backup;
        if (!backup.match(/^[\w\.]+\.zip$/)) throw new Error("Invalid backup");

        const backupDir = application.getDataPath("backups");
        const backupFile = `${backupDir}/${backup}`
        const targetFile = application.getDataPath("restore.zip");

        await fs.promises.copyFile(backupFile, targetFile);

        res.render("result", {
            message: "Backup copied, please restart Itokawa to apply.",
            okLink: PATH_BACKUP
        });
    }
    catch (err) {
        res.render("result", {
            errorMessage: err,
            okLink: PATH_BACKUP
        });
    }
});

export async function getRouter(): Promise<express.Router> {
    return _router;
}