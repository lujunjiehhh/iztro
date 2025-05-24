/**
 * @file mcp-server-stdio.test.ts
 * @description Basic unit tests for mcp-server-stdio.ts using child_process.
 */

import * as child_process from 'child_process';
import * as path from 'path';
import { PalaceName, DiZhi } from './mcp-tools'; // For test case params

// --- Configuration ---
// Adjust this path if your compiled JS file is elsewhere or if using ts-node
const serverScriptPath = path.join(__dirname, 'mcp-server-stdio.js'); 
// Fallback for ts-node execution if .js is not found (e.g. in dev)
const serverScriptTsPath = path.join(__dirname, 'mcp-server-stdio.ts');
const useTsNode = !require('fs').existsSync(serverScriptPath) && require('fs').existsSync(serverScriptTsPath);


// --- Test Runner Helper ---
interface ProcessOutput {
  stdout: string[];
  stderr: string[];
  exitCode: number | null;
}

/**
 * Runs the MCP server script as a child process and interacts with it.
 * @param {string[]} inputLines - An array of JSON strings to send to the server's stdin.
 * @param {number} expectedOutputLines - The number of stdout lines expected before resolving.
 * @returns {Promise<ProcessOutput>} The collected stdout, stderr, and exit code.
 */
function runServerProcess(inputLines: string[], expectedOutputLines: number = inputLines.length): Promise<ProcessOutput> {
  return new Promise((resolve, reject) => {
    const command = useTsNode ? 'ts-node' : 'node';
    const script = useTsNode ? serverScriptTsPath : serverScriptPath;
    
    if (!require('fs').existsSync(script)) {
        return reject(new Error(`Server script not found at ${script}. Compile mcp-server-stdio.ts to JS or ensure ts-node is available.`));
    }

    const serverProcess = child_process.spawn(command, [script]);

    const output: ProcessOutput = {
      stdout: [],
      stderr: [],
      exitCode: null,
    };

    let outputLinesReceived = 0;

    serverProcess.stdout.on('data', (data) => {
      const lines = data.toString().trim().split('\n').filter((line: string) => line.trim() !== '');
      output.stdout.push(...lines);
      outputLinesReceived += lines.length;
      if (outputLinesReceived >= expectedOutputLines) {
        if (!serverProcess.killed) serverProcess.kill(); // Terminate after expected output
      }
    });

    serverProcess.stderr.on('data', (data) => {
      output.stderr.push(...data.toString().trim().split('\n'));
    });

    serverProcess.on('error', (err) => {
      console.error("Test Harness: Failed to start server process.", err);
      reject(err);
    });
    
    serverProcess.on('exit', (code) => {
      output.exitCode = code;
      // Resolve even if not all expected lines are received, to allow timeout/error checks
      resolve(output);
    });

    inputLines.forEach(line => {
      serverProcess.stdin.write(line + '\n');
    });
    serverProcess.stdin.end(); // Close stdin to signal no more input

    // Timeout to prevent tests from hanging indefinitely
    setTimeout(() => {
        if (!serverProcess.killed) serverProcess.kill();
        reject(new Error(`Test timed out after 3000ms waiting for ${expectedOutputLines} lines. Received ${outputLinesReceived}. Stdout: ${output.stdout.join('\\n')}. Stderr: ${output.stderr.join('\\n')}`));
    }, 3000);
  });
}

// --- Expectation Utility (Simple) ---
const expect = (actual: any) => ({
  toBe: (expected: any) => {
    if (actual !== expected) {
      throw new Error(`AssertionError: Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`);
    }
  },
  toBeDefined: () => {
    if (actual === undefined) {
      throw new Error(`AssertionError: Expected value to be defined, but got ${JSON.stringify(actual)}`);
    }
  },
  toContain: (substring: string) => {
    if (typeof actual !== 'string' || !actual.includes(substring)) {
      throw new Error(`AssertionError: Expected "${actual}" to contain "${substring}"`);
    }
  },
  toBeGreaterThan: (expected: number) => {
    if (typeof actual !== 'number' || actual <= expected) {
        throw new Error(`AssertionError: Expected ${actual} to be greater than ${expected}`);
    }
  },
  toHaveLength: (expected: number) => {
    if (!actual || typeof actual.length !== 'number' || actual.length !== expected) {
        throw new Error(`AssertionError: Expected length ${expected}, but got ${actual?.length}. Actual: ${JSON.stringify(actual)}`);
    }
  }
});


// --- Test Cases ---

/**
 * Test Case 1: Malformed JSON Input
 */
async function testMalformedJSON() {
  console.log('\nRunning Test: Malformed JSON Input...');
  const inputLine = "this is not valid json";
  const processOutput = await runServerProcess([inputLine], 1);

  expect(processOutput.stdout).toHaveLength(1);
  const response = JSON.parse(processOutput.stdout[0]);

  expect(response.status).toBe("error");
  // The error message for pure JSON parse failure might be generic from the catch block
  // or specific if the initial parsing in the server is more nuanced.
  // Based on current server logic: "Request is not a valid MCP request object or missing required fields (requestId, toolId)."
  // If JSON.parse itself fails before any custom checks, it would be "Invalid JSON input or processing error."
  // Let's assume the server's initial check for object structure and required fields catches it.
  expect(response.error.code).toBe("PROCESSING_ERROR"); // Or "INVALID_JSON" if parsing fails earlier. The generic catch sets PROCESSING_ERROR
  expect(response.error.message).toContain("Request is not a valid MCP request object");
  // requestId might be null or 'unknown'
  console.log("Test Malformed JSON Input: PASSED");
}

/**
 * Test Case 2: Unknown Tool ID
 */
async function testUnknownToolId() {
  console.log('\nRunning Test: Unknown Tool ID...');
  const requestId = "test-unknown-tool-001";
  const inputLine = JSON.stringify({
    requestId: requestId,
    toolId: "MCP-XYZ-UnknownTool",
    params: {},
  });
  const processOutput = await runServerProcess([inputLine], 1);

  expect(processOutput.stdout).toHaveLength(1);
  const response = JSON.parse(processOutput.stdout[0]);

  expect(response.requestId).toBe(requestId);
  expect(response.status).toBe("error");
  expect(response.error.code).toBe("TOOL_NOT_FOUND");
  expect(response.error.message).toContain("MCP-XYZ-UnknownTool");
  console.log("Test Unknown Tool ID: PASSED");
}

/**
 * Test Case 3: Valid Request for MCP-F02 (Get_Palace_Info)
 */
async function testValidRequestF02() {
  console.log('\nRunning Test: Valid Request for MCP-F02...');
  const requestId = "test-f02-valid-002";
  const params = { palaceName: PalaceName.Ming };
  const inputLine = JSON.stringify({
    requestId: requestId,
    toolId: "Get_Palace_Info",
    params: params,
  });
  const processOutput = await runServerProcess([inputLine], 1);

  expect(processOutput.stdout).toHaveLength(1);
  const response = JSON.parse(processOutput.stdout[0]);

  expect(response.requestId).toBe(requestId);
  expect(response.status).toBe("success");
  expect(response.data).toBeDefined();
  expect(response.data.palaceName).toBe(PalaceName.Ming);
  expect(response.data.palaceDiZhi).toBeDefined();
  expect(response.data.palaceTianGan).toBeDefined();
  expect(response.data.coreMeaning).toBeDefined();
  console.log("Test Valid Request MCP-F02: PASSED");
}

/**
 * Test Case 4: Invalid Params for MCP-F02 (Get_Palace_Info)
 */
async function testInvalidParamsF02() {
  console.log('\nRunning Test: Invalid Params for MCP-F02...');
  const requestIdPrefix = "test-f02-invalid-003";
  
  // Test 1: Invalid palaceName type (number instead of string)
  let params1 = { palaceName: 123 };
  let inputLine1 = JSON.stringify({
    requestId: requestIdPrefix + "-a",
    toolId: "Get_Palace_Info",
    params: params1,
  });
  let processOutput1 = await runServerProcess([inputLine1], 1);
  expect(processOutput1.stdout).toHaveLength(1);
  let response1 = JSON.parse(processOutput1.stdout[0]);
  expect(response1.requestId).toBe(requestIdPrefix + "-a");
  expect(response1.status).toBe("error");
  expect(response1.error.code).toBe("INVALID_PARAMS");
  expect(response1.error.message).toContain("palaceName parameter is required and must be a non-empty string");

  // Test 2: Invalid palaceName string value
  let params2 = { palaceName: "InvalidPalaceName" };
  let inputLine2 = JSON.stringify({
    requestId: requestIdPrefix + "-b",
    toolId: "Get_Palace_Info",
    params: params2,
  });
  let processOutput2 = await runServerProcess([inputLine2], 1);
  expect(processOutput2.stdout).toHaveLength(1);
  let response2 = JSON.parse(processOutput2.stdout[0]);
  expect(response2.requestId).toBe(requestIdPrefix + "-b");
  expect(response2.status).toBe("error");
  expect(response2.error.code).toBe("INVALID_PARAMS");
  expect(response2.error.message).toContain("Invalid palaceName: 'InvalidPalaceName'");
  
  console.log("Test Invalid Params MCP-F02: PASSED");
}

/**
 * Test Case 5: Valid Request for a Tool with Array Output (e.g., MCP-F03 Get_Stars_In_Palace)
 */
async function testValidRequestF03ArrayOutput() {
  console.log('\nRunning Test: Valid Request for MCP-F03 (Array Output)...');
  const requestId = "test-f03-valid-array-004";
  const params = { palaceIdentifier: DiZhi.Yin };
  const inputLine = JSON.stringify({
    requestId: requestId,
    toolId: "Get_Stars_In_Palace",
    params: params,
  });
  const processOutput = await runServerProcess([inputLine], 1);

  expect(processOutput.stdout).toHaveLength(1);
  const response = JSON.parse(processOutput.stdout[0]);

  expect(response.requestId).toBe(requestId);
  expect(response.status).toBe("success");
  expect(Array.isArray(response.data)).toBe(true);
  if (Array.isArray(response.data)) { // Type guard for TS
    expect(response.data.length).toBeGreaterThan(0); // Mock should return some stars
    response.data.forEach((star: any) => {
      expect(star.starName).toBeDefined();
      expect(star.starType).toBeDefined();
    });
  }
  console.log("Test Valid Request MCP-F03 (Array Output): PASSED");
}

// --- Main Test Execution ---
async function runAllAvailableTests() {
  const tests = [
    testMalformedJSON,
    testUnknownToolId,
    testValidRequestF02,
    testInvalidParamsF02,
    testValidRequestF03ArrayOutput,
  ];
  let allPassed = true;

  for (const test of tests) {
    try {
      await test();
    } catch (error: any) {
      allPassed = false;
      console.error(`Test FAILED: ${test.name}`);
      console.error("Error:", error.message);
      if (error.stack) {
        console.error(error.stack);
      }
    }
  }

  if (allPassed) {
    console.log("\nAll mcp-server-stdio.ts integration tests PASSED!");
  } else {
    console.error("\nSome mcp-server-stdio.ts integration tests FAILED.");
    process.exit(1); // Indicate failure
  }
}

// Only run tests if this file is executed directly
if (require.main === module) {
  // Check if the script is being run with ts-node or if the JS version exists
  if (useTsNode) {
    console.log("Attempting to run tests using ts-node for mcp-server-stdio.ts...");
    runAllAvailableTests();
  } else if (require('fs').existsSync(serverScriptPath)) {
    console.log("Attempting to run tests using node for mcp-server-stdio.js...");
    runAllAvailableTests();
  } else {
    console.error(`ERROR: Cannot run tests. Neither ${serverScriptTsPath} (for ts-node) nor ${serverScriptPath} (for node) found.`);
    console.error("Please ensure mcp-server-stdio.ts is compiled to .js in the same directory, or run with ts-node if available.");
    process.exit(1);
  }
}

export { 
    runAllAvailableTests as runAllTests, // Exporting for potential external runner
    testMalformedJSON, 
    testUnknownToolId, 
    testValidRequestF02, 
    testInvalidParamsF02, 
    testValidRequestF03ArrayOutput 
};
