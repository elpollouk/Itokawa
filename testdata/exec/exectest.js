console.log("Hello World!");

console.log("stdout data");
console.error("stderr data");

let exitCode = 0;
if (process.argv.length >= 3) {
    exitCode = parseInt(process.argv[2]);
}
process.exit(exitCode);