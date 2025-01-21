const vscode = require('vscode');
const cors = require('cors');
const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const DataMap = new Map();

function getFilePath() {
  const system = process.platform;
  switch (system) {
    case 'win32':
      return process.env.USERPROFILE + '\\AppData\\Roaming\\';
    case 'linux':
    case 'darwin':
    default:
      return '/tmp/';
  }
}

function activate(context) {
  // Initialize Express server
  const app = express();
  
  // Configure CORS
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept']
  }));
  
  app.use(express.json());
  
  // Handle preflight requests
  app.options('*', cors());

  let panel;
  let testCases = [];

  // Handle test case submissions
  app.post('/testcases', (req, res) => {
    try {
      const { id, testCases: receivedTestCases } = req.body;

      if (!receivedTestCases) {
        res.status(400).json({ error: 'Invalid test case format' });
        return;
      }

      testCases = receivedTestCases;

      if (!panel) {
        panel = vscode.window.createWebviewPanel(
          'testCases',
          'Test Cases',
          vscode.ViewColumn.Beside,
          { enableScripts: true }
        );

        panel.onDidDispose(() => {
          panel = null;
        });
      }

      // Store test cases in DataMap
      const currentContent = DataMap.get(id);
      if (currentContent) {
        DataMap.set(id, [...currentContent, testCases]);
      } else {
        DataMap.set(id, [testCases]);
      }

      // Update webview content
      panel.webview.html = getWebviewContent(testCases, [], id);

      // Handle messages from webview
      panel.webview.onDidReceiveMessage(
        async message => {
          if (message.command === 'submit') {
            const code = message.code;
            const input = message.input;
            
            try {
              const codeFilePath = "./code.cpp";
              fs.writeFileSync(codeFilePath, code);
  
              // Prepare the input file
              const inputFilePath = "./input.txt";
              fs.writeFileSync(inputFilePath, input);

              // Write code and input files
              fs.writeFileSync(codeFilePath, message.code, { encoding: 'utf8', flag: 'w' });
              fs.writeFileSync(inputFilePath, message.input, { encoding: 'utf8', flag: 'w' });
              console.log(codeFilePath)
              console.log(inputFilePath)
              // Execute code in Docker
              const dockerCommand = `docker run --rm -v ${codeFilePath}:/app/code.cpp -v "${inputFilePath}:/app/input.txt" cpp-runner bash -c "g++ /app/code.cpp -o /app/code && /app/code < /app/input.txt"`;
              console.log(dockerCommand)
              exec(dockerCommand, (error, stdout, stderr) => {
                if (error) {
                  panel.webview.postMessage({
                    command: 'output',
                    success: false,
                    output: stderr || error.message
                  });
                  return;
                }

                panel.webview.postMessage({
                  command: 'output',
                  success: true,
                  output: stdout.trim()
                });
              });
            } catch (error) {
              panel.webview.postMessage({
                command: 'output',
                success: false,
                output: error.message
              });
            }
          }
        },
        undefined,
        context.subscriptions
      );

      res.json({ status: 'success', received: testCases });
    } catch (error) {
      console.error('Error processing request:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Start the server
  app.listen(3000, () => {
    console.log('Server listening on http://localhost:3000');
  });

  // Register VS Code command
  let disposable = vscode.commands.registerCommand(
    'extension.runTestCases',
    () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
      }

      if (!testCases.length) {
        vscode.window.showErrorMessage('No test cases available');
        return;
      }

      if (panel) {
        panel.reveal();
      }
    }
  );

  context.subscriptions.push(disposable);
}

function getWebviewContent(testCases, results = [], id) {
  const test_cases = DataMap.get(id) || [];
  let html = '';
  
  test_cases.forEach((tc, index) => {
    html += `<div class="test-case">
      <h3>Case ${index + 1}</h3>
      <ul>
        ${tc.map(c => `<li>${c.variable}: ${c.value}</li>`).join('')}
      </ul>
    </div>`;
  });

  const plainText = test_cases
    .map(tc => tc.join(' '))
    .join('\n');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Test Case Viewer</title>
      <style>
        body { padding: 20px; font-family: system-ui; }
        textarea { width: 100%; margin: 10px 0; padding: 8px; }
        button { padding: 8px 16px; }
        .test-case { margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <h2>Code Editor</h2>
      <textarea id="code" rows="10" placeholder="Enter your code here..."></textarea>
      
      <h2>Input</h2>
      <textarea id="input" rows="8" readonly>${plainText}</textarea>
      
      <button id="btn">Run Code</button>
      
      <h2>Output</h2>
      <textarea id="output" rows="8" readonly></textarea>

      <script>
        const vscode = acquireVsCodeApi();
        
        document.getElementById('btn').addEventListener('click', () => {
          const code = document.getElementById('code').value;
          const input = document.getElementById('input').value;
          
          vscode.postMessage({
            command: 'submit',
            code: code,
            input: input
          });
        });

        window.addEventListener('message', event => {
          const message = event.data;
          if (message.command === 'output') {
            const outputArea = document.getElementById('output');
            outputArea.value = message.output;
            outputArea.style.color = message.success ? 'black' : 'red';
          }
        });
      </script>
    </body>
    </html>
  `;
}

function deactivate() {
  // Cleanup code
}

module.exports = {
  activate,
  deactivate
};