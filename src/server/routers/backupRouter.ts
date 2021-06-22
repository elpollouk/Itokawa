import * as express from "express";
import * as fileUpload from "express-fileupload";
import { application } from "../../application";
import * as fs from "fs";
import { requirePermission } from "./authRouter";
import { Permissions } from "../sessionmanager";
import { PATH_BACKUP } from "../../common/constants";
import * as backup from "../../utils/backup";
import { Logger } from "../../utils/logger";

const log = new Logger("Backup");

const VALID_BACKUP = /^[\w\.-]+\.zip$/;

let _backupDir: string = null;

const _router = express.Router();
_router.use(requirePermission(Permissions.SERVER_BACKUP))
_router.use(fileUpload());
_router.use(express.urlencoded({extended: true}));

_router.route("/")
.get(async (_, res)=> {
    const backups: string[] = [];
    const backupDir = application.getDataPath("backups");

    log.verbose(() => `Getting backups from ${backupDir}`);

    if (fs.existsSync(backupDir)) {
        const files = await fs.promises.readdir(backupDir);
        for (const file of files) {
            if (file.endsWith(".zip")) {
                log.debug(() => `Found backup: ${file}`);
                backups.push(file);
            }
            else {
                log.debug(() => `Other file: ${file}`);
            }
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

        log.info(() => `Uploaded ${copyDest}`);
        res.redirect(PATH_BACKUP);
    }
    catch (err) {
        log.warning(() => `Error uploading file: ${err.stack}`);
        res.render("result", {
            errorMessage: err,
            okLink: PATH_BACKUP
        });
    }
});

_router.route("/rename")
.post(async (req, res) => {
    try {
        const from = req.body["from"];
        const to = req.body["to"];
        if (!from) throw new Error("No source provided");
        if (!from.match(VALID_BACKUP)) throw new Error("Invalid backup name");
        if (!to) throw new Error("No destination provided");
        if (!to.match(VALID_BACKUP)) throw new Error("Invalid backup name");

        const backupDir = application.getDataPath("backups");
        const fromFile = `${backupDir}/${from}`;
        const toFile = `${backupDir}/${to}`;

        if (!fs.existsSync(fromFile)) throw new Error("Backup does not exist");
        if (fs.existsSync(toFile)) throw new Error("Backup with that name already exists");

        await fs.promises.rename(fromFile, toFile);

        log.info(() => `Renamed ${fromFile} to ${toFile}`);
        res.render("result", {
            message: "Backup renamed.",
            okLink: PATH_BACKUP
        });
    }
    catch (err) {
        log.warning(() => `Error renaming file: ${err.stack}`);
        res.render("result", {
            errorMessage: err,
            okLink: PATH_BACKUP
        });
    }
})

_router.route("/create")
.get(async (_, res) => {
    try {
        let backupFile = await backup.createBackup(
            application.database,
            application.getDataPath(),
            application.getDataPath("backups")
        );

        backupFile = backupFile.split('/').pop();

        log.info(() => `Backup ${backupFile} created`);
        res.render("result", {
            message: `${backupFile} created.`,
            okLink: PATH_BACKUP
        });
    }
    catch (err) {
        log.warning(() => `Error creating backup: ${err.stack}`);
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
            log.info(() => `Deleted backup ${backupFile}`);
        }
        else {
            log.info(() => `Backup ${backupFile} doesn't exist`);
        }

        res.render("result", {
            message: "Backup deleted.",
            okLink: PATH_BACKUP
        });
    }
    catch (err) {
        log.warning(() => `Error deleting backup: ${err.stack}`);
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

        log.info(() => `Backup ${backupFile} copied to ${targetFile}`);
        res.render("result", {
            message: "Backup staged, please restart Itokawa to apply.",
            okLink: PATH_BACKUP
        });
    }
    catch (err) {
        log.warning(() => `Error restoring backup: ${err.stack}`);
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
    log.info(() => `Backup download directory set to ${path}`);
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
