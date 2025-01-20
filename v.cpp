if (Array.isArray(receivedData)) {
            testCases = receivedData; // It's already an array
        } else if (typeof receivedData === 'object') {
            testCases = [receivedData]; // Convert an object to an array with a single object inside
        } else {
            testCases = [receivedData]; // Convert primitive types to an array with the value as the only element
        }

const isCorrect = sandbox.output === testCase.expectedOutput;
            results.push({
                testCase: testCase,
                output: sandbox.output,
                isCorrect: isCorrect,
            });


const vscode = require('vscode');
const http = require('http');
const cors = require('cors');
const express = require('express');
const vm = require('vm'); // Node.js module for sandboxed code execution

const DataMap = new Map;

function activate(context) {
    //console.log('Congratulations, your extension "vscode-http-server" is now active!');

    const app = express();
    app.use(cors());
    app.use(express.json());

    let panel; // Variable to store the Webview panel
    let testCases = []; // Variable to store received test cases


    // Define a test endpoint to handle POST requests
    app.post('/testcases', (req, res) => {
        const receivedData = req.body;
        //console.log("RecievedData",JSON.stringify(receivedData))
        // Log the type of received data
        if (Array.isArray(receivedData)) {
            //console.log('Received test cases: Array');
        } else if (typeof receivedData === 'object') {
            //console.log('Received test cases: Object');
        } else {
            //console.log('Received test cases: ' + typeof receivedData);
        }

        //console.log('Data content:', receivedData);
        
        // Convert received data to an array, regardless of its type
        if (Array.isArray(receivedData.testCases)) {
            testCases = receivedData.testCases.map(tc => ({
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
        if (!panel) {
            panel = vscode.window.createWebviewPanel(
                'testCases', // Internal identifier
                'Test Cases', // Title of the panel
                vscode.ViewColumn.Beside, // Editor column to show the panel
                { enableScripts: true } // Enable JavaScript in the webview
            );

            panel.onDidDispose(() => {
                panel = null; // Reset the panel when closed
            });
        }

        const currentContent = DataMap.get(receivedData.id);
        if(currentContent){
            DataMap.set(receivedData.id,[...currentContent,receivedData.testCases]);
        }else{
            DataMap.set(receivedData.id,[receivedData.testCases])
        }

        console.log("current Map",JSON.stringify(DataMap.get(receivedData.id)));

        // Update panel content
        panel.webview.html = getWebviewContent(testCases,[],receivedData.id);

        res.json({ status: 'success', received: testCases });
    });

    // Start the server on port 8080
    app.listen(8080, () => {
        //console.log('Server is listening on http://localhost:8080');
    });

    // Register the 'http-server.runTestCases' command
    let disposable = vscode.commands.registerCommand('http-server.runTestCases', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found to run the code.');
            return;
        }

        const userCode = editor.document.getText();

        if (!testCases.length) {
            vscode.window.showErrorMessage('No test cases received yet.');
            return;
        }

        // Run user code against test cases
        const results = runCodeAgainstTestCases(userCode, testCases);
        
        // Display results in the webview panel
        if (panel) {
            panel.webview.html = getWebviewContent(testCases, results);
        } else {
            vscode.window.showErrorMessage('Test case panel is not available.');
        }
    });

    context.subscriptions.push(disposable);
}

function runCodeAgainstTestCases(userCode, testCases) {
    const results = [];
    //console.log("Running code against test cases:", testCases);
    testCases.forEach((testCase, index) => {
        //console.log(`Processing Test Case ${index + 1}:`, testCase);
        try {
            const sandbox = { input: testCase.input, output: null };
            vm.createContext(sandbox); // Create a sandbox for execution

            // Run user code
            vm.runInContext(
                `${userCode}; output = solve(input);`, // Assume user code defines a `solve` function
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
                output: `Error: ${err.message}`,
                isCorrect: false,
            });
        }
    });

    return results;
}

function getWebviewContent(testCases, results = [],id) {
    //console.log("testCases",testCases);
    //console.log("results",results);
    const test_cases = DataMap.get(id);
    let html = "";
    test_cases.map((tc,index)=>{
        html += `<ul> Case ${index +1 } </ul>`
        tc.map((c,index)=>{
            html+=`<li>${c.variable} ${c.value}</li>`;
        })
    })

    console.log(html);

    const testCasesHtml = testCases.map((tc, i) =>
       `<li>Test Case ${i + 1}: Input = ${JSON.stringify(tc.input)}</li>`
    ).join('');
    //console.log("testcaseHTML",testCasesHtml)

    const resultsHtml = results.map((res, i) =>
        `<li>Test Case ${i + 1}: Output = ${JSON.stringify(res.output)}, Correct = ${res.isCorrect}</li>`
    ).join('');

    //console.log("resultsHTML",resultsHtml);

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Test Cases</title>
        </head>
        <body>
            <h1>Test Cases</h1>
            ${html}
            <h2>Results</h2>
            <ul>${resultsHtml}</ul>
        </body>
        </html>
    `;

}

function deactivate() {
    // No specific cleanup for now
}

module.exports = {
    activate,
    deactivate
};





<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title></title>
          
          </head>
          <body>
          <textarea id="code">
        
          </textarea>
          <textarea name="" id="input">${plainText}</textarea>
          <button id="btn">Submit</button>
          <script>
            const vscode = aquireVsCodeApi();
            vscode.postMessage({content:"hello"})
          </script>
          </body>
          </html>