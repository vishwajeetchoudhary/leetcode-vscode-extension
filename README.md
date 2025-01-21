# VSCode LeetCode CPH Extension

A powerful VSCode extension that integrates LeetCode with Competitive Programming Helper (CPH). This extension streamlines the process of fetching LeetCode test cases and running them directly within VSCode using Docker for execution. Ideal for competitive programmers looking to enhance their productivity.

---

## Features

- **Fetch LeetCode Test Cases**: Automatically fetch test cases from LeetCode problems using the provided browser extension.
- **Code Execution**: Compile and execute code snippets directly within VSCode using Docker.
- **Test Case Viewer**: View and edit test cases in a convenient webview.
- **Integrated Workflow**: Seamless integration between LeetCode, test case fetching, and code execution in VSCode.
---

## Installation

### 1. Prerequisites

- **Docker**: Ensure Docker is installed and running on your machine. [Install Docker](https://www.docker.com/products/docker-desktop)
- **VSCode**: Install Visual Studio Code. [Download VSCode](https://code.visualstudio.com/)
- **Node.js**: Required for running the extension server. [Install Node.js](https://nodejs.org/)

### 2. Extension Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   ```
2. Open the cloned repository in VSCode.
3. Run the following commands in the terminal to install dependencies:
   ```bash
   npm install
   ```
4. Press `F5` in VSCode to start debugging and run the extension.

### 3. Browser Extension Installation

1. Navigate to the browser extension folder and load it as an unpacked extension:
   - For Chrome: Go to `chrome://extensions` → Enable "Developer mode" → Click "Load unpacked" → Select the browser extension folder.

---

## Usage

### 1. Fetch Test Cases from LeetCode

1. Open a LeetCode problem in your browser.
2. Click on the browser extension icon to fetch the test cases.
3. The test cases will be sent to the local server and appear in the VSCode test case viewer.

### 2. Run Code with Test Cases

1. Write your solution in the VSCode editor.
2. Use the `Run Test Cases` command to compile and execute your code against the fetched test cases.
3. View the output in the webview panel within VSCode.


---

## Technical Details

### How It Works

1. **Test Case Fetching**:
   - The browser extension scrapes test cases from the LeetCode webpage and sends them to a local Express server.
2. **Test Case Management**:
   - The server manages test cases in memory and updates the VSCode webview dynamically.
3. **Code Execution**:
   - User code and test case input are saved to files.
   - Docker compiles and executes the code within a containerized environment.
4. **Webview Panel**:
   - Displays fetched test cases, allows code editing, and shows execution results.

---