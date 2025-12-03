import React, { useEffect, useRef, useState } from "react";
import {
  Play,
  FileText,
  Code,
  AlertCircle,
  GitBranch,
  Globe,
  Sparkles,
  Zap,
  FileCode,
  Trash2,
  Download,
  X,
  Maximize2,
} from "lucide-react";
import Editor from "@monaco-editor/react";

declare global {
  interface Window {
    loadPyodide?: any;
    mermaid?: any;
  }
}


const GEMINI_API_KEY = "AIzaSyDAocp4IoFW4S1tz9bxOYOgLTGjUWsxl6w";
const BACKEND_RUN_URL = "http://localhost:5000/run-code";

// Human readable names for explanation language
const languageNames: Record<string, string> = {
  english: "English",
  hindi: "Hindi",
  kannada: "Kannada",
  tamil: "Tamil",
};

const SmartStudentIDE: React.FC = () => {
  const [code, setCode] = useState(
    localStorage.getItem("smartIDE-code") ||
      '# Write your Python code here\nprint("Hello, World!")'
  );
  const [output, setOutput] = useState("");
  const [explanation, setExplanation] = useState("");
  const [diagramSource, setDiagramSource] = useState(""); // Mermaid text
  const [diagramSvg, setDiagramSvg] = useState(""); // Rendered SVG as string
  const [errors, setErrors] = useState("");

  const [language, setLanguage] = useState(
    localStorage.getItem("smartIDE-lang") || "english"
  );
  const [codingLanguage, setCodingLanguage] = useState<"python" | "java">(
    (localStorage.getItem("smartIDE-code-lang") as "python" | "java") ||
      "python"
  );
  const [activeTab, setActiveTab] = useState<
    "explanation" | "diagram" | "errors"
  >("explanation");

  const [isGenerating, setIsGenerating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // stdin for both Python & Java
  const [userInput, setUserInput] = useState("");

  // Pyodide state (real Python runtime)
  const [pyodide, setPyodide] = useState<any | null>(null);
  const [pythonReady, setPythonReady] = useState(false);
  const [isPyodideLoading, setIsPyodideLoading] = useState(false);

  const outputRef = useRef<HTMLDivElement | null>(null);

  // Diagram modal
  const [showDiagramModal, setShowDiagramModal] = useState(false);

  // ===========================
  //  PERSIST TO LOCALSTORAGE
  // ===========================
  useEffect(() => {
    localStorage.setItem("smartIDE-code", code);
  }, [code]);

  useEffect(() => {
    localStorage.setItem("smartIDE-code-lang", codingLanguage);
  }, [codingLanguage]);

  useEffect(() => {
    localStorage.setItem("smartIDE-lang", language);
  }, [language]);

  // ===========================
  //  LOAD PYODIDE (Python)
  // ===========================
  useEffect(() => {
    const load = async () => {
      if (!window.loadPyodide || pyodide) return;
      try {
        setIsPyodideLoading(true);
        const instance = await window.loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.1/full/",
        });
        setPyodide(instance);
        setPythonReady(true);
      } catch (e) {
        console.error("Pyodide load error:", e);
        setOutput((prev) => prev + "\n⚠ Failed to load Python runtime.");
      } finally {
        setIsPyodideLoading(false);
      }
    };

    load();
  }, [pyodide]);

  // ===========================
  //  RENDER MERMAID DIAGRAM
  // ===========================
  useEffect(() => {
    if (!diagramSource || !diagramSource.trim()) {
      setDiagramSvg("");
      return;
    }

    // Only bother rendering when in diagram tab or modal open
    if (activeTab !== "diagram" && !showDiagramModal) return;

const mermaid = window.mermaid;
if (!mermaid) {
  console.warn("Mermaid is not loaded on window.");
  setDiagramSvg(
    '<p style="color:#fca5a5;font-size:12px;">⚠ Mermaid not loaded.</p>'
  );
  return;
}

(async () => {
  try {
    const uniqueId = "smart-diagram-" + Date.now();

    // New v10+ API: returns { svg, bindFunctions }
    const { svg } = await mermaid.render(uniqueId, diagramSource);

    setDiagramSvg(svg);
  } catch (e: any) {
    console.error("Mermaid render error:", e);
    setDiagramSvg(
      `<p style="color:#fca5a5;font-size:12px;">⚠ Diagram render failed: ${
        e?.message || "Check Mermaid syntax."
      }</p>`
    );
  }
})();
  }, [diagramSource, activeTab, showDiagramModal]);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // ===========================
  //  RUN CODE  (Python + Java)
  // ===========================
  const runCode = async () => {
    setIsRunning(true);
    setOutput((prev) => prev + (prev ? "\n" : "") + ">>> Running...\n");

    try {
      // ------------------------
      // PYTHON (Pyodide + input())
      // ------------------------
      if (codingLanguage === "python") {
        if (!pythonReady || !pyodide) {
          setOutput((prev) => prev + "⚠ Python runtime not ready yet.\n");
        } else {
          // Inject custom input() using userInput (stdin)
          const wrapped = `
import sys
from io import StringIO

_buffer = StringIO()
_stdout = sys.stdout
sys.stdout = _buffer

_input_data = """${userInput}""".split("\\n")
_input_index = 0

def input(prompt=None):
    global _input_index
    if _input_index < len(_input_data):
        val = _input_data[_input_index]
        _input_index += 1
        return val
    return ""

try:
${code
  .split("\n")
  .map((l) => "    " + l)
  .join("\n")}
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    sys.stdout = _stdout
    _result = _buffer.getvalue()
`;

          await pyodide.runPythonAsync(wrapped);
          const result = pyodide.globals.get("_result");
          const text = result ? String(result) : "";
          setOutput((prev) =>
            prev +
            (text.trim()
              ? text
              : ">>> Code executed successfully (no output)\n")
          );
        }
        setIsRunning(false);
        return;
      }

      // ------------------------
      // JAVA (REAL NODE BACKEND)
      // ------------------------
      if (codingLanguage === "java") {
        try {
          const resp = await fetch(BACKEND_RUN_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              language: "java",
              code,
              input: userInput,
            }),
          });

          if (!resp.ok) {
            const text = await resp.text();
            setOutput(
              (prev) =>
                prev + `\n⚠ Backend error (${resp.status}): ${text || "N/A"}`
            );
          } else {
            const data = await resp.json();
            if (data.error) {
              setOutput((prev) => prev + "\n" + data.error);
            } else {
              setOutput(
                (prev) =>
                  prev +
                  "\n" +
                  (data.output !== undefined && data.output !== null
                    ? String(data.output)
                    : "No output")
              );
            }
          }
        } catch (e: any) {
          setOutput(
            (prev) =>
              prev +
              "\n⚠ Unable to reach Java backend: " +
              (e?.message || String(e))
          );
        }
        setIsRunning(false);
        return;
      }
    } catch (err: any) {
      setOutput(
        (prev) =>
          prev +
          "\n⚠ Runtime Error:\n" +
          (err?.message || String(err)) +
          "\n"
      );
    } finally {
      setIsRunning(false);
    }
  };

  const clearOutput = () => {
    setOutput("");
  };

  const downloadCode = () => {
    const ext = codingLanguage === "python" ? "py" : "java";
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smart_ide_code.${ext}`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const callGemini = async (prompt: string) => {
    if (!GEMINI_API_KEY) return "⚠ Gemini API key missing.";

    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      const data = await resp.json();

      if (data.error) {
        return "⚠ AI Error: " + (data.error.message || "Unknown error");
      }

      return (
        data.candidates?.[0]?.content?.parts
          ?.map((p: any) => p.text)
          ?.join("\n") || "⚠ No AI response received."
      );
    } catch (e) {
      console.error(e);
      return "⚠ Network Error while calling AI.";
    }
  };

  const getToneInstruction = () => {
    const langName = languageNames[language] || "English";
    return `Use a friendly, conversational tone in ${langName}.
Imagine you are an understanding senior helping a junior.
Avoid very formal or textbook style. Use simple words and small chunks.`;
  };

  const generateExplanation = async () => {
    setIsGenerating(true);
    setActiveTab("explanation");
    setExplanation("🤖 Thoda ruk, code dekh raha hoon...");

    const prompt = `
You are a friendly coding tutor.

Language of explanation: ${languageNames[language] || "English"}
Programming language of code: ${codingLanguage.toUpperCase()}

${getToneInstruction()}

Explain this code step by step:
- Start with a short overview of what the code does.
- Then explain the main parts in small sections.
- Give simple examples or intuition where helpful.
- If there are inputs/outputs, explain them too.

Code:
${code}
    `.trim();

    const res = await callGemini(prompt);

    setExplanation(res);
    setIsGenerating(false);
  };

  const generateDiagram = async () => {
    setIsGenerating(true);
    setActiveTab("diagram");
    setDiagramSource("flowchart TD\n  A[Preparing diagram] --> B[Calling AI]");

    const prompt = `
Convert the following ${codingLanguage.toUpperCase()} code into VALID Mermaid flowchart code.

VERY STRICT RULES:
- Output ONLY Mermaid code (no explanation, no backticks).
- Must start with: flowchart TD
- Use short node IDs: A, B, C, D...
- Use --> arrows.
- Use { } for decision nodes.
- Keep node text short and readable.

Code:
${code}
    `.trim();

    let raw = await callGemini(prompt);

    if (!raw) {
      setDiagramSource("");
      setIsGenerating(false);
      return;
    }

    raw = raw
      .replace(/```mermaid/gi, "")
      .replace(/```/g, "")
      .replace(/\r/g, "")
      .trim();

    
    const idx = raw.toLowerCase().indexOf("flowchart");
    if (idx > 0) {
      raw = raw.slice(idx);
    }

    if (!raw.toLowerCase().startsWith("flowchart")) {
      raw = "flowchart TD\n" + raw;
    }

   
    let clean = raw.replace(/[^\w\s{}\[\]().,\-+>|/:?!"'\n]/g, "");

  
    clean = clean.replace(/\t/g, "  ").trim();
clean = clean.replace(/\"/g, "'");

    setDiagramSource(clean);
    setIsGenerating(false);

    console.log("RAW DIAGRAM FROM AI → ", raw);
  };

  const analyzeErrors = async () => {
    setIsGenerating(true);
    setActiveTab("errors");
    setErrors("🔍 Thoda wait, mistakes aur improvements dekh raha hoon...");

    const prompt = `
You are a friendly senior developer reviewing a student's code.

Language of explanation: ${languageNames[language] || "English"}
Programming language of code: ${codingLanguage.toUpperCase()}

${getToneInstruction()}

Task:
- First, check for syntax errors or obvious bugs.
- Then suggest improvements: readability, naming, structure, best practices.
- Explain each point in a simple way, like you are talking to a beginner.
- If everything is okay, say "No issues found! Great job!"

Code:
${code}
    `.trim();

    const res = await callGemini(prompt);

    setErrors(res);
    setIsGenerating(false);
  };

  const getMonacoLanguage = () =>
    codingLanguage === "python" ? "python" : "java";

  // ===========================
  //  UI
  // ===========================
  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-gradient-to-r from-indigo-900/80 via-purple-900/80 to-sky-900/80 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 shadow-md">
            <Code className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg bg-gradient-to-r from-sky-200 to-purple-200 bg-clip-text text-transparent">
              Smart IDE
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-yellow-300" />
              ML-Powered Learning Environment
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2 bg-slate-900/70 border border-slate-700 rounded-lg px-3 py-1.5">
            <FileCode className="w-4 h-4 text-sky-400" />
            <select
              value={codingLanguage}
              onChange={(e) =>
                setCodingLanguage(e.target.value as "python" | "java")
              }
              className="bg-transparent outline-none text-slate-100"
            >
              <option value="python">Python</option>
              <option value="java">Java (backend)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-900/70 border border-slate-700 rounded-lg px-3 py-1.5">
            <Globe className="w-4 h-4 text-emerald-400" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent outline-none text-slate-100"
            >
              <option value="english">English</option>
              <option value="hindi">हिंदी</option>
              <option value="kannada">ಕನ್ನಡ</option>
              <option value="tamil">தமிழ்</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-700">
            <Zap
              className={`w-3 h-3 ${
                pythonReady ? "text-emerald-400" : "text-slate-500"
              }`}
            />
            <span>
              Python:{" "}
              {codingLanguage === "python"
                ? pythonReady
                  ? "Ready"
                  : isPyodideLoading
                  ? "Loading..."
                  : "Not loaded"
                : "Disabled"}
            </span>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* LEFT – Editor & Terminal */}
        <div className="flex-[1.4] flex flex-col border-r border-slate-800 bg-slate-950/70 min-h-0">
          {/* Editor Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/70">
            <div className="flex items-center gap-2 text-sm font-semibold text-sky-300">
              <Code className="w-4 h-4" />
              <span>Code Editor</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={runCode}
                disabled={isRunning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-700/60 text-white font-medium shadow-sm shadow-emerald-500/30 transition-transform hover:scale-[1.02]"
              >
                <Play className="w-3 h-3" />
                {isRunning ? "Running..." : "Run"}
              </button>
              <button
                onClick={clearOutput}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 text-[11px]"
              >
                <Trash2 className="w-3 h-3" />
                Clear Output
              </button>
              <button
                onClick={downloadCode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sky-700 hover:bg-sky-600 text-sky-50 border border-sky-500/60 text-[11px]"
              >
                <Download className="w-3 h-3" />
                Download
              </button>
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 min-h-0">
            <Editor
              value={code}
              language={getMonacoLanguage()}
              theme="vs-dark"
              onChange={(value) => setCode(value || "")}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                automaticLayout: true,
                scrollBeyondLastLine: false,
                wordWrap: "on",
              }}
            />
          </div>

          {/* Input box for stdin */}
          <div className="border-t border-slate-800 bg-slate-900/80 p-2">
            <p className="text-xs text-slate-400 mb-1">
              Program Input (stdin) – har line{" "}
              <code>input()</code> / <code>Scanner</code> dwara read hogi:
            </p>
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              rows={3}
              placeholder={
                codingLanguage === "java"
                  ? "Example:\nRavi\n10\n20"
                  : "Example:\n5\n10"
              }
              className="w-full bg-black/80 border border-slate-700 rounded-md p-2 text-xs text-slate-200 font-mono"
            />
          </div>

          {/* Terminal */}
          <div className="h-52 border-t border-slate-800 bg-gradient-to-b from-slate-950 to-black">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/80 text-xs">
              <div className="flex items-center gap-2 text-amber-300">
                <Zap className="w-3 h-3" />
                <span>Terminal Output</span>
              </div>
              <span className="text-[10px] text-slate-400">
                Shows printed output & runtime logs
              </span>
            </div>
            <div
              ref={outputRef}
              className="h-full overflow-auto text-[12px] font-mono bg-black/95 text-emerald-400 px-4 py-3"
            >
              {output || ">>> Ready. Write code and click Run."}
            </div>
          </div>
        </div>

        {/* RIGHT – AI Panels */}
        <div className="flex-[1] flex flex-col bg-slate-950/60 min-h-0">
          {/* Tabs */}
          <div className="flex border-b border-slate-800 text-sm">
            <button
              onClick={() => setActiveTab("explanation")}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 border-r border-slate-800 transition-colors ${
                activeTab === "explanation"
                  ? "bg-sky-700 text-white"
                  : "bg-slate-900 hover:bg-slate-800 text-slate-300"
              }`}
            >
              <FileText className="w-4 h-4" />
              Explanation
            </button>
            <button
              onClick={() => setActiveTab("diagram")}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 border-r border-slate-800 transition-colors ${
                activeTab === "diagram"
                  ? "bg-purple-700 text-white"
                  : "bg-slate-900 hover:bg-slate-800 text-slate-300"
              }`}
            >
              <GitBranch className="w-4 h-4" />
              Diagram
            </button>
            <button
              onClick={() => setActiveTab("errors")}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 transition-colors ${
                activeTab === "errors"
                  ? "bg-red-700 text-white"
                  : "bg-slate-900 hover:bg-slate-800 text-slate-300"
              }`}
            >
              <AlertCircle className="w-4 h-4" />
              Errors
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 p-4 overflow-auto text-sm space-y-3">
            {/* Explanation */}
            {activeTab === "explanation" && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-sky-400" />
                    <h2 className="font-semibold text-sky-100">
                      Code Explanation
                    </h2>
                  </div>
                  <button
                    onClick={generateExplanation}
                    disabled={isGenerating}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sky-700 hover:bg-sky-600 disabled:bg-slate-700 text-white text-xs shadow-sm"
                  >
                    <Sparkles className="w-3 h-3" />
                    {isGenerating ? "Thinking..." : "Explain"}
                  </button>
                </div>
                <div className="bg-slate-900/80 border border-sky-700/40 rounded-xl p-3 min-h-[260px] whitespace-pre-wrap text-xs leading-relaxed text-slate-100 shadow-inner">
                  {explanation ||
                    "Click Explain to get a friendly, beginner-style explanation of your code."}
                </div>
              </>
            )}

            {/* Diagram */}
            {activeTab === "diagram" && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-purple-400" />
                    <h2 className="font-semibold text-purple-100">
                      Visual Flow Diagram
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {diagramSvg && (
                      <button
                        onClick={() => setShowDiagramModal(true)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs text-slate-100 border border-slate-600"
                      >
                        <Maximize2 className="w-3 h-3" />
                        Full View
                      </button>
                    )}
                    <button
                      onClick={generateDiagram}
                      disabled={isGenerating}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-700 hover:bg-purple-600 disabled:bg-slate-700 text-white text-xs shadow-sm"
                    >
                      <Sparkles className="w-3 h-3" />
                      {isGenerating ? "Drawing..." : "Generate"}
                    </button>
                  </div>
                </div>
                <div className="bg-slate-900/80 border border-purple-700/40 rounded-xl p-3 min-h-[260px] flex items-center justify-center">
                  {diagramSource && diagramSvg ? (
                    <div className="w-full bg-white rounded-lg p-2 max-h-[320px] overflow-auto cursor-pointer"
                         onClick={() => setShowDiagramModal(true)}>
                      <div
                        dangerouslySetInnerHTML={{ __html: diagramSvg }}
                      />
                      <p className="text-[10px] text-center text-slate-500 mt-1">
                        Click to open full diagram
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center">
                      Click Generate to see a Mermaid flowchart of your code
                      logic.
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Errors */}
            {activeTab === "errors" && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <h2 className="font-semibold text-red-100">
                      Error & Improvement Analysis
                    </h2>
                  </div>
                  <button
                    onClick={analyzeErrors}
                    disabled={isGenerating}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-700 hover:bg-red-600 disabled:bg-slate-700 text-white text-xs shadow-sm"
                  >
                    <Sparkles className="w-3 h-3" />
                    {isGenerating ? "Checking..." : "Check"}
                  </button>
                </div>
                <div className="bg-slate-900/80 border border-red-700/40 rounded-xl p-3 min-h-[260px] whitespace-pre-wrap text-xs leading-relaxed text-slate-100 shadow-inner">
                  {errors ||
                    "Click Check to get a friendly explanation of what might be wrong and how you can improve your code."}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* DIAGRAM MODAL (Center Popup) */}
      {showDiagramModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={() => setShowDiagramModal(false)}
        >
          <div
            className="bg-slate-950 border border-purple-500/60 rounded-2xl max-w-5xl w-full max-h-[90vh] shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-purple-500/40 bg-gradient-to-r from-purple-900 via-slate-900 to-indigo-900">
              <div className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-purple-300" />
                <h2 className="text-sm font-semibold text-purple-50">
                  Code Flow Diagram
                </h2>
              </div>
              <button
                onClick={() => setShowDiagramModal(false)}
                className="p-1 rounded-full hover:bg-purple-500/20 text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 bg-slate-900/90 p-4 overflow-auto">
              {diagramSvg ? (
                <div className="bg-white rounded-lg p-3 inline-block">
                  <div
                    dangerouslySetInnerHTML={{ __html: diagramSvg }}
                  />
                </div>
              ) : (
                <p className="text-xs text-slate-300">
                  Diagram not available. Try generating again.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartStudentIDE;
