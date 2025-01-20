const vscode = require("vscode");
const cors = require("cors");
const express = require("express");
const vm = require("vm");
const path = require("path");
const fs = require('fs');
const {exec} = require('child_process');

const DataMap = new Map();

function getFilePath() {
  const system = process.platform;
  switch (system) {
    case "win32":
      // Get the Windows path but keep it in a format Node.js can use
      const windowsPath = process.env.USERPROFILE + '\\AppData\\Roaming\\';
      return windowsPath;
    case "linux":
      return "/tmp/"
    case "darwin":
      return "/tmp/"
    default:
      return "/tmp/"
  }
}

function getDockerPath(windowsPath) {
  // Convert Windows path to Docker format only when used in Docker command
  return windowsPath
    .replace(/\\/g, '/')  // Replace backslashes with forward slashes
    .replace(/^([A-Za-z]):/, '$1:') // Keep drive letter format
    .toLowerCase();
}

function activate(context) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  let panel;
  let testCases = [];

  app.post("/testcases", (req, res) => {
    const receivedData = req.body;

    if (Array.isArray(receivedData.testCases)) {
      testCases = receivedData.testCases.map((tc) => ({
        input: tc.value,
      }));
    } else {
      res.status(400).json({ error: "Invalid test case format" });
      return;
    }

    let jsUri;
    if (!panel) {
      panel = vscode.window.createWebviewPanel(
        "testCases",
        "Test Cases",
        vscode.ViewColumn.Beside,
        { enableScripts: true }
      );

      const jsFilePath = vscode.Uri.file(
        path.join(context.extensionPath, "index.js")
      );

      jsUri = panel.webview.asWebviewUri(jsFilePath);

      panel.onDidDispose(() => {
        panel = null;
      });
    }

    const currentContent = DataMap.get(receivedData.id);
    if (currentContent) {
      DataMap.set(receivedData.id, [...currentContent, receivedData.testCases]);
    } else {
      DataMap.set(receivedData.id, [receivedData.testCases]);
    }

    panel.webview.html = getWebviewContent(
      testCases,
      [],
      receivedData.id,
      jsUri
    );

    panel.webview.onDidReceiveMessage(
      (message) => {
        if (message.command === "submit") {
          const code = message.code;
          const input = message.input;

          try {
            // Use Windows path for file operations
            const filePath = getFilePath();
            const codeFilePath = path.join(filePath, "code.cpp");
            const inputFilePath = path.join(filePath, "input.txt");
            
            // Write files using Windows paths
            fs.writeFileSync(codeFilePath, code);
            fs.writeFileSync(inputFilePath, input);

            // Convert to Docker paths for the Docker command
            const dockerCodePath = getDockerPath(codeFilePath);
            const dockerInputPath = getDockerPath(inputFilePath);

            // Create Docker command with converted paths
            const dockerCommand = `docker run --rm -v "${dockerCodePath}:/app/code.cpp" -v "${dockerInputPath}:/app/input.txt" cpp-runner bash -c "g++ /app/code.cpp -o /app/code && /app/code < /app/input.txt"`;

            exec(dockerCommand, { shell: 'bash' }, (error, stdout, stderr) => {
              if (error) {
                console.error("Error executing code in Docker:", error.message);
                panel.webview.postMessage({
                  command: "output",
                  success: false,
                  output: stderr || error.message,
                });
                return;
              }

              panel.webview.postMessage({
                command: "output",
                success: true,
                output: stdout.trim(),
              });
            });
          } catch (error) {
            console.error("Error:", error);
            panel.webview.postMessage({
              command: "output",
              success: false,
              output: error.message,
            });
          }
        }
      },
      undefined,
      context.subscriptions
    );

    res.json({ status: "success", received: testCases });
  });

  app.listen(8080, () => {
    console.log("Server is listening on http://localhost:8080");
  });

  let disposable = vscode.commands.registerCommand(
    "http-server.runTestCases",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor found to run the code.");
        return;
      }

      const userCode = editor.document.getText();

      if (!testCases.length) {
        vscode.window.showErrorMessage("No test cases received yet.");
        return;
      }

      const results = runCodeAgainstTestCases(userCode, testCases);

      if (panel) {
        panel.webview.html = getWebviewContent(testCases, results);
      } else {
        vscode.window.showErrorMessage("Test case panel is not available.");
      }
    }
  );

  context.subscriptions.push(disposable);
}

function runCodeAgainstTestCases(userCode, testCases) {
  const results = [];
  testCases.forEach((testCase, index) => {
    try {
      const sandbox = { input: testCase.input, output: null };
      vm.createContext(sandbox);

      vm.runInContext(
        `${userCode}; output = solve(input);`,
        sandbox
      );
      results.push({
        testCase: testCase,
        output: sandbox.output,
      });
    } catch (err) {
      results.push({
        testCase: testCase,
        output: `Error: ${err.message}`,
        isCorrect: false,
      });
    }
  });

  return results;
}

function getWebviewContent(testCases, results = [], id, jsUri) {
  const test_cases = DataMap.get(id);
  let html = "";
  test_cases.map((tc, index) => {
    html += `<ul> Case ${index + 1} </ul>`;
    tc.map((c, index) => {
      html += `<li>${c.variable} ${c.value}</li>`;
    });
  });

  let plainText = test_cases
    .map(
      (tc, outerIndex) =>
        `Case ${outerIndex + 1}:\n` +
        tc.map((c) => `  ${c.variable}: ${c.value}`).join("\n")
    )
    .join("\n\n");

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Test Case Viewer</title>
    </head>
    <body>
      <textarea id="code"></textarea>
      <textarea name="" id="input">${plainText}</textarea>
      <button id="btn">Submit</button>
      <textarea id="output"></textarea>
      <script>
        const vscode = acquireVsCodeApi();

        function handleSubmit() {
          const code = document.getElementById('code').value;
          const input = document.getElementById('input').value;

          vscode.postMessage({
            command: 'submit',
            code: code,
            input: input
          });
        }

        document.getElementById('btn').addEventListener('click', handleSubmit);

        window.addEventListener('message', (event) => {
          const message = event.data;
          const area = document.getElementById('output');
          area.value = message.output;
        });
      </script>
    </body>
    </html>
  `;
}

function deactivate() {
  // Cleanup code if needed
}

module.exports = {
  activate,
  deactivate,
};