const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { exec, spawn } = require("child_process");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const TEMP_DIR = path.join(__dirname, "temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

app.post("/run-code", (req, res) => {
  const { language, code, input = "" } = req.body;

  if (!code || !language) {
    return res.status(400).json({ error: "Missing code or language" });
  }

  if (language === "java") {
    runJava(code, input, res);
  } else if (language === "python") {
    runPython(code, input, res);
  } else {
    return res.status(400).json({ error: "Unsupported language" });
  }
});

function runJava(code, input, res) {
  const filePath = path.join(TEMP_DIR, "Main.java");

  fs.writeFileSync(filePath, code, "utf8");

  // Compile
  exec(`javac "${filePath}"`, (compileErr, stdout, stderr) => {
    if (compileErr || stderr) {
      return res.json({
        output: "",
        error: `Compile error:\n${stderr || compileErr.toString()}`
      });
    }

    // Run
    const runProcess = spawn("java", ["-cp", TEMP_DIR, "Main"], {
      shell: process.platform === "win32", // Windows compatibility
    });

    let out = "";
    let err = "";

    runProcess.stdout.on("data", (data) => {
      out += data.toString();
    });

    runProcess.stderr.on("data", (data) => {
      err += data.toString();
    });

    runProcess.on("error", (e) => {
      return res.json({ output: "", error: e.toString() });
    });

    runProcess.on("close", (codeExit) => {
      return res.json({
        output: out,
        error: err || (codeExit !== 0 ? `Process exited with code ${codeExit}` : "")
      });
    });

    // Feed input to program (Scanner, etc.)
    if (input) {
      runProcess.stdin.write(input);
    }
    runProcess.stdin.end();
  });
}

function runPython(code, input, res) {
  const filePath = path.join(TEMP_DIR, "main.py");
  fs.writeFileSync(filePath, code, "utf8");

  const pyCmd = process.platform === "win32" ? "python" : "python3";

  const pyProcess = spawn(pyCmd, [filePath], {
    shell: process.platform === "win32",
  });

  let out = "";
  let err = "";

  pyProcess.stdout.on("data", (data) => {
    out += data.toString();
  });

  pyProcess.stderr.on("data", (data) => {
    err += data.toString();
  });

  pyProcess.on("error", (e) => {
    return res.json({ output: "", error: e.toString() });
  });

  pyProcess.on("close", (codeExit) => {
    return res.json({
      output: out,
      error: err || (codeExit !== 0 ? `Process exited with code ${codeExit}` : "")
    });
  });

  if (input) {
    pyProcess.stdin.write(input);
  }
  pyProcess.stdin.end();
}

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Compiler backend running on http://localhost:${PORT}`);
});
