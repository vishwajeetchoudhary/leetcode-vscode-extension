const vscode = require("vscode");
const cors = require("cors");
const express = require("express");
const vm = require("vm"); // Node.js module for sandboxed code execution
const path = require("path");
const fs = require('fs');
const {exec} = require('child_process')

const DataMap = new Map();

console.log("hello");

function activate(context) {
  //console.log('Congratulations, your extension "vscode-http-server" is now active!');

  const app = express();
  app.use(cors());
  app.use(express.json());

  let panel; // Variable to store the Webview panel
  let testCases = []; // Variable to store received test cases

  // Define a test endpoint to handle POST requests
  app.post("/testcases", (req, res) => {
    const receivedData = req.body;
    //console.log("RecievedData",JSON.stringify(receivedData))
    // Log the type of received data
    if (Array.isArray(receivedData)) {
      //console.log('Received test cases: Array');
    } else if (typeof receivedData === "object") {
      //console.log('Received test cases: Object');
    } else {
      //console.log('Received test cases: ' + typeof receivedData);
    }

    //console.log('Data content:', receivedData);

    // Convert received data to an array, regardless of its type
    if (Array.isArray(receivedData.testCases)) {
      testCases = receivedData.testCases.map((tc) => ({
        input: tc.value, // Map "value" to "input"
        //expectedOutput: null // Placeholder for expected output
      }));
      //console.log("Transformed Test Cases:", testCases);
    } else {
      //console.error("Invalid test case format:", receivedData);
      res.status(400).json({ error: "Invalid test case format" });
      return;
    }
    //console.log("Test Cases Sent to Webview:", JSON.stringify(testCases, null, 2));
    // Create or update a webview panel to show test cases
    let jsUri;
    if (!panel) {
      panel = vscode.window.createWebviewPanel(
        "testCases", // Internal identifier
        "Test Cases", // Title of the panel
        vscode.ViewColumn.Beside, // Editor column to show the panel
        { enableScripts: true } // Enable JavaScript in the webview
      );

      const jsFilePath = vscode.Uri.file(
        path.join(context.extensionPath, "index.js")
      );

      jsUri = panel.webview.asWebviewUri(jsFilePath);

      panel.onDidDispose(() => {
        panel = null; // Reset the panel when closed
      });
    }

    const currentContent = DataMap.get(receivedData.id);
    if (currentContent) {
      DataMap.set(receivedData.id, [...currentContent, receivedData.testCases]);
    } else {
      DataMap.set(receivedData.id, [receivedData.testCases]);
    }

    console.log("current Map", JSON.stringify(DataMap.get(receivedData.id)));

    // Update panel content
    panel.webview.html = getWebviewContent(
      testCases,
      [],
      receivedData.id,
      jsUri
    );

    panel.webview.onDidReceiveMessage(
      (message) => {
        console.log(message)
        if (message.command == "submit") {
          
          const code = message.code;
          const input = message.input;



          try {
            const codeFilePath = "C:\Users\code.cpp";
            fs.writeFileSync(codeFilePath, code);

            // Prepare the input file
            const inputFilePath = "C:\Users\input.txt";
            fs.writeFileSync(inputFilePath, input);

            // Run the Docker container
            const command = docker run --rm -v ${codeFilePath}:/app/code.cpp -v ${inputFilePath}:/app/input.txt cpp-runner bash -c "g++ /app/code.cpp -o /app/code && /app/code < /app/input.txt";

            exec(command, (error, stdout, stderr) => {
              if (error) {
                console.error("Error executing code in Docker:", error.message);
                panel.webview.postMessage({
                  command: "output",
                  success: false,
                  output: stderr || error.message,
                });
                return;
              }

              console.log("STDOUT",stdout)

              panel.webview.postMessage({
                command: "output",
                success: true,
                output: stdout.trim(),
              });
            });
          } catch (error) {
            console.log(error)
          }
        }
      },
      undefined,
      context.subscriptions
    );

    res.json({ status: "success", received: testCases });
  });

  // Start the server on port 8080
  app.listen(3000, () => {
    console.log("Server is listening on http://localhost:3000");
  });

  // Register the 'http-server.runTestCases' command
  let disposable = vscode.commands.registerCommand(
    "http-server.runTestCases",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage(
          "No active editor found to run the code."
        );
        return;
      }

      const userCode = editor.document.getText();

      if (!testCases.length) {
        vscode.window.showErrorMessage("No test cases received yet.");
        return;
      }

      // Run user code against test cases
      const results = runCodeAgainstTestCases(userCode, testCases);

      // Display results in the webview panel
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
  //console.log("Running code against test cases:", testCases);
  testCases.forEach((testCase, index) => {
    //console.log(Processing Test Case ${index + 1}:, testCase);
    try {
      const sandbox = { input: testCase.input, output: null };
      vm.createContext(sandbox); // Create a sandbox for execution

      // Run user code
      vm.runInContext(
        ${userCode}; output = solve(input);, // Assume user code defines a solve function
        sandbox
      );
      // Add output to results
      results.push({
        testCase: testCase,
        output: sandbox.output,
      });
    } catch (err) {
      results.push({
        testCase: testCase,
        output: Error: ${err.message},
        isCorrect: false,
      });
    }
  });

  return results;
}

function fetchCodeFromActiveEditor() {
  // Get the active text editor
  const editor = vscode.window.activeTextEditor;

  if (editor) {
    // Get the document from the editor
    const document = editor.document;

    // Fetch the code (text) from the document
    const code = document.getText();

    // Output the fetched code (can be sent to an API, saved, etc.)
    console.log("Fetched code:", code);

    // You can return the code if needed
    return code;
  } else {
    // If no active editor is found
    console.log("No active editor found!");
    return null;
  }
}

function getWebviewContent(testCases, results = [], id, jsUri) {
  //console.log("testCases",testCases);
  //console.log("results",results);
  const test_cases = DataMap.get(id);
  let html = "";
  test_cases.map((tc, index) => {
    html += <ul> Case ${index + 1} </ul>;
    tc.map((c, index) => {
      html += <li>${c.variable} ${c.value}</li>;
    });
  });

  let plainText = test_cases
    .map(
      (tc, outerIndex) =>
        Case ${outerIndex + 1}:\n +
        tc.map((c) => `  ${c.variable}: ${c.value}`).join("\n")
    )
    .join("\n\n");

  console.log(plainText);
  //const code_written = fetchCodeFromActiveEditor();
  //console.log(code_written);
  const testCasesHtml = testCases
    .map(
      (tc, i) =>
        <li>Test Case ${i + 1}: Input = ${JSON.stringify(tc.input)}</li>
    )
    .join("");
  //console.log("testcaseHTML",testCasesHtml)

  const resultsHtml = results
    .map(
      (res, i) =>
        `<li>Test Case ${i + 1}: Output = ${JSON.stringify(
          res.output
        )}, Correct = ${res.isCorrect}</li>`
    )
    .join("");

  //console.log("resultsHTML",resultsHtml);
  function escapeHTML(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  console.log("jsURI", jsUri);

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

              console.log('Code:', code);
              console.log('Input:', input);

              vscode.postMessage({
                command: 'submit',
                code: code,
                input: input
              });
            }

            document.getElementById('btn').addEventListener('click', handleSubmit);

            window.addEventListener('message',(event)=>{
              console.log("MESSAGE",event.data)
              const message = event.data;
              const area = document.getElementById('output');
              area.value = message.output;
            })
          </script>
        </body>
        </html>
        `;
}

function deactivate() {
  // No specific cleanup for now
}

module.exports = {
  activate,
  deactivate,
};