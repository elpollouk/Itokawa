function deleteBackup() {
    return confirm("Are you sure you want to delete this back up?");
}

function restoreBackup() {
    return confirm("Are you sure you want to restore this back up?");
}

function uploadFile(value) {
    if (value) document.getElementById("UploadForm").submit();
}
