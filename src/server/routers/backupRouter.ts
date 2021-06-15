import * as express from "express";
import * as fileUpload from "express-fileupload";
import { application } from "../../application";
import * as fs from "fs";
import { requirePermission } from "./authRouter";
import { Permissions } from "../sessionmanager";
import { PATH_BACKUP } from "../../common/constants";
import * as backup from "../../utils/backup";

const VALID_BACKUP = /^[\w\.-]+\.zip$/;

let _backupDir: string = null;

const _router = express.Router();
_router.use(requirePermission(Permissions.SERVER_BACKUP))
_router.use(fileUpload());

_router.route("/")
.get(async (_: express.Request, res: express.Response)=> {
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
})
.post(async (req, res) => {
    try {
        if (!req.files || !req.files.file) throw new Error("No file uploaded");

        const file = req.files.file as fileUpload.UploadedFile;
        if (!file.name.match(VALID_BACKUP)) throw new Error("Not a backup file");

        const copyDest = `${_backupDir}/${file.name}`;
        if (fs.existsSync(copyDest)) throw new Error("Backup already exists");

        await file.mv(copyDest);
        res.redirect(PATH_BACKUP);
    }
    catch (err) {
        res.render("result", {
            errorMessage: err,
            okLink: PATH_BACKUP
        });
    }
});

_router.route("/create")
.get(async (_, res) => {
    try {
        let backupFile = await backup.createBackup(
            application.database,
            application.getDataPath(),
            application.getDataPath("backups")
        );

        backupFile = backupFile.split('/').pop();

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

_router.route("/delete/:backup")
.get(async (req, res) => {
    try {
        const backup = req.params.backup;
        if (!backup.match(VALID_BACKUP)) throw new Error("Invalid backup");

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

_router.route("/restore/:backup")
.get(async (req, res) => {
    try {
        const backup = req.params.backup;
        if (!backup.match(VALID_BACKUP)) throw new Error("Invalid backup");

        const backupDir = application.getDataPath("backups");
        const backupFile = `${backupDir}/${backup}`
        const targetFile = application.getDataPath("restore.zip");

        await fs.promises.copyFile(backupFile, targetFile);

        res.render("result", {
            message: "Backup staged, please restart Itokawa to apply.",
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

export function setDownloadDir(path: string) {
    _backupDir = path;
    _router.use("/download", (req, res, next) => {
        if (req.path.endsWith(".zip")) {
            next();
        }
        else {
            res.sendStatus(404);
        }
    });
    _router.use("/download", express.static(path));
}