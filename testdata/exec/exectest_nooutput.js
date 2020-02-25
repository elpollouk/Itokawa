let exitCode = 0;
if (process.argv.length >= 3) {
    exitCode = parseInt(process.argv[2]);
}
process.exit(exitCode);