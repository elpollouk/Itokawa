function deleteBackup() {
    return confirm("Are you sure you want to delete this back up?");
}

function renameBackup(backupName) {
    const newName = prompt(`Rename ${backupName} to:`, backupName);
    if (newName && newName != backupName) {
        document.getElementById("from").value = backupName;
        document.getElementById("to").value = newName;
        document.getElementById("RenameForm").submit();
    }
    return false;
}

function restoreBackup() {
    return confirm("Are you sure you want to restore this back up?");
}

function uploadFile(value) {
    if (value) document.getElementById("UploadForm").submit();
}
