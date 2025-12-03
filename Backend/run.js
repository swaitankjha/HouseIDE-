const fs = require("fs");

// Read code from temp file passed by Python
const filePath = process.argv[2];

try {
    const code = fs.readFileSync(filePath, "utf8");

    // Capture console.log
    const log = console.log;
    console.log = (...args) => process.stdout.write(args.join(" ") + "\n");

    eval(code);
} catch (err) {
    console.error("Runtime Error:", err.message);
}