/**
 * @file mcp-server-stdio.test.ts
 * @description Unit tests for mcp-server-stdio.ts using child_process.
 */

import * as child_process from 'child_process';
import * as path from 'path';
import { 
    PalaceName, DiZhi, TianGan, StarType, Gender, WuXingJu, SiHuaType, ChartLevel, 
    BrightnessLevel, WuXing, YinYang, BasicLuck,
    // MCP-A03 and SYS-01 related
    StoreStarCombinationMeaningInputParams, 
    InitializeChartOutputData,
    StoredStarCombinationMatch
} from './mcp-tools';

// --- Configuration ---
const serverScriptPathJs = path.join(__dirname, 'mcp-server-stdio.js'); 
const serverScriptPathTs = path.join(__dirname, 'mcp-server-stdio.ts');
const scriptToExecute = require('fs').existsSync(serverScriptPathJs) ? serverScriptPathJs : serverScriptPathTs;
const commandToExecute = require('fs').existsSync(serverScriptPathJs) ? 'node' : 'ts-node';

// --- Test Runner Helper ---
interface ProcessOutput {
  stdout: string[];
  stderr: string[];
  exitCode: number | null;
}

function runServerProcess(inputLines: string[], expectedOutputLines: number = inputLines.length): Promise<ProcessOutput> {
  return new Promise((resolve, reject) => {
    if (!require('fs').existsSync(scriptToExecute)) {
        return reject(new Error(`Server script not found at ${scriptToExecute}. Compile mcp-server-stdio.ts to JS or ensure ts-node is available.`));
    }

    const serverProcess = child_process.spawn(commandToExecute, [scriptToExecute]);
    const output: ProcessOutput = { stdout: [], stderr: [], exitCode: null };
    let outputLinesReceived = 0;
    let allInputSent = false;
    let stdoutBuffer = "";

    serverProcess.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();
      let EOL_index;
      while ((EOL_index = stdoutBuffer.indexOf('\n')) >= 0) {
        const line = stdoutBuffer.substring(0, EOL_index).trim();
        stdoutBuffer = stdoutBuffer.substring(EOL_index + 1);
        if (line) {
          try { 
            JSON.parse(line); // Ensure it's valid JSON before pushing
            output.stdout.push(line); 
            outputLinesReceived++;
          } catch (e) { 
            console.warn("Non-JSON stdout line ignored:", line); 
          }
        }
      }
      if (allInputSent && outputLinesReceived >= expectedOutputLines) {
        if (!serverProcess.killed) serverProcess.kill();
      }
    });

    serverProcess.stderr.on('data', (data) => { output.stderr.push(...data.toString().trim().split('\n').filter(l=>l)); });
    serverProcess.on('error', (err) => { console.error("Test Harness: Failed to start server process.", err); reject(err); });
    
    serverProcess.on('exit', (code) => {
      // Process any remaining stdout buffer
      if (stdoutBuffer.trim()) {
        const lines = stdoutBuffer.trim().split('\n').filter((line: string) => line.trim() !== '');
         lines.forEach(line => {
            try { JSON.parse(line); output.stdout.push(line); outputLinesReceived++; } 
            catch (e) { console.warn("Non-JSON stdout line (on exit) ignored:", line); }
         });
      }
      output.exitCode = code; 
      resolve(output); 
    });

    inputLines.forEach(line => { serverProcess.stdin.write(line + '\n'); });
    serverProcess.stdin.end();
    allInputSent = true;
    if (outputLinesReceived >= expectedOutputLines && !serverProcess.killed) {
        serverProcess.kill();
    }
    
    setTimeout(() => {
        if (!serverProcess.killed) serverProcess.kill();
        if (outputLinesReceived < expectedOutputLines) {
            reject(new Error(`Test timed out after 5000ms waiting for ${expectedOutputLines} lines. Received ${outputLinesReceived}. Stdout: ${output.stdout.join('\\n')}. Stderr: ${output.stderr.join('\\n')}`));
        } else {
            resolve(output); // Resolve if enough lines were received just before timeout
        }
    }, 5000);
  });
}

// --- Expectation Utility (Simple) ---
const expect = (actual: any) => ({
  toBe: (expected: any) => { if (actual !== expected) { throw new Error(`AssertionError: Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`); } },
  toBeDefined: () => { if (actual === undefined) { throw new Error(`AssertionError: Expected value to be defined, but got ${JSON.stringify(actual)}`); } },
  toBeUndefined: () => { if (actual !== undefined) { throw new Error(`AssertionError: Expected value to be undefined, but got ${JSON.stringify(actual)}`); } },
  toBeNull: () => { if (actual !== null) { throw new Error(`AssertionError: Expected value to be null, but got ${JSON.stringify(actual)}`); } },
  toBeTruthy: () => { if (!actual) { throw new Error(`AssertionError: Expected ${JSON.stringify(actual)} to be truthy`); } },
  toBeInstanceOf: (expectedType: any) => { if (!(actual instanceof expectedType)) { throw new Error(`AssertionError: Expected instance of ${expectedType.name}, but got ${actual?.constructor?.name || typeof actual}`); } },
  toContain: (substring: string) => { if (typeof actual !== 'string' || !actual.includes(substring)) { throw new Error(`AssertionError: Expected "${actual}" to contain "${substring}"`); } },
  toBeGreaterThan: (expected: number) => { if (typeof actual !== 'number' || actual <= expected) { throw new Error(`AssertionError: Expected ${actual} to be greater than ${expected}`); } },
  toHaveLength: (expected: number) => { if (!actual || typeof actual.length !== 'number' || actual.length !== expected) { throw new Error(`AssertionError: Expected length ${expected}, but got ${actual?.length}. Actual: ${JSON.stringify(actual)}`); } },
  toBeType: (expectedType: "string" | "number" | "boolean" | "object" | "array" | "function") => { if (expectedType === "array") { if (!Array.isArray(actual)) { throw new Error(`AssertionError: Expected type array but got ${typeof actual}`); } } else if (typeof actual !== expectedType) { throw new Error(`AssertionError: Expected type ${expectedType} but got ${typeof actual}`); } },
  toBeOneOf: (expectedValues: any[]) => { if (!expectedValues.includes(actual)) { throw new Error(`AssertionError: Expected ${JSON.stringify(actual)} to be one of ${JSON.stringify(expectedValues)}`); } },
  toEqual: (expected: any) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) { throw new Error(`AssertionError: Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`); } },
});

// --- Test Data ---
const validInitParams = { birthDate: "1990-03-15", birthTimeIndex: 5, gender: "男", isLunar: false, fixLeap: true };
const initRequestLine = (requestId: string) => JSON.stringify({ requestId, toolId: "MCP-SYS-01", params: validInitParams });
const initFemaleRequestLine = (requestId: string) => JSON.stringify({ requestId, toolId: "MCP-SYS-01", params: { ...validInitParams, gender: "女"} });


// --- Test Cases ---
async function testMalformedJSON() { /* ... same as before ... */ console.log('\nRunning Test: Malformed JSON Input...'); const inputLine = "this is not valid json"; const processOutput = await runServerProcess([inputLine], 1); expect(processOutput.stdout).toHaveLength(1); const response = JSON.parse(processOutput.stdout[0]); expect(response.status).toBe("error"); expect(response.error.code).toBe("PROCESSING_ERROR");  expect(response.error.message).toContain("Request is not a valid MCP request object"); console.log("Test Malformed JSON Input: PASSED"); }
async function testUnknownToolId() { /* ... same as before ... */  console.log('\nRunning Test: Unknown Tool ID...'); const requestId = "test-unknown-tool-001"; const inputLine = JSON.stringify({ requestId, toolId: "MCP-XYZ-UnknownTool", params: {} }); const processOutput = await runServerProcess([inputLine], 1); expect(processOutput.stdout).toHaveLength(1); const response = JSON.parse(processOutput.stdout[0]); expect(response.requestId).toBe(requestId); expect(response.status).toBe("error"); expect(response.error.code).toBe("TOOL_NOT_FOUND"); expect(response.error.message).toContain("MCP-XYZ-UnknownTool"); console.log("Test Unknown Tool ID: PASSED"); }

async function testInitializeChartSuccess() { console.log('\nRunning Test: Initialize Chart Success...'); const requestId = "test-init-success-001"; const processOutput = await runServerProcess([initRequestLine(requestId)], 1); expect(processOutput.stdout).toHaveLength(1); const response = JSON.parse(processOutput.stdout[0]); expect(response.requestId).toBe(requestId); expect(response.status).toBe("success"); expect(response.data).toBeDefined(); expect(response.data.success).toBe(true); expect(response.data.matchedCombinations).toBeUndefined(); console.log("Test Initialize Chart Success: PASSED"); }
async function testInitializeChartInvalidParams() { console.log('\nRunning Test: Initialize Chart Invalid Params...'); const requestId = "test-init-invalid-002"; const invalidParams = { ...validInitParams, birthTimeIndex: 99 }; const inputLine = JSON.stringify({ requestId, toolId: "MCP-SYS-01", params: invalidParams }); const processOutput = await runServerProcess([inputLine], 1); expect(processOutput.stdout).toHaveLength(1); const response = JSON.parse(processOutput.stdout[0]); expect(response.requestId).toBe(requestId); expect(response.status).toBe("error"); expect(response.error.code).toBe("INVALID_PARAMS"); expect(response.error.message).toContain("birthTimeIndex must be between 0 and 12"); console.log("Test Initialize Chart Invalid Params: PASSED"); }
async function testChartNotInitializedError() { console.log('\nRunning Test: Chart Not Initialized Error...'); const requestId = "test-no-init-003"; const inputLine = JSON.stringify({ requestId, toolId: "Get_Chart_Basics", params: {} }); const processOutput = await runServerProcess([inputLine], 1); expect(processOutput.stdout).toHaveLength(1); const response = JSON.parse(processOutput.stdout[0]); expect(response.requestId).toBe(requestId); expect(response.status).toBe("error"); expect(response.error.code).toBe("CHART_NOT_INITIALIZED"); expect(response.error.message).toContain("Chart not initialized"); console.log("Test Chart Not Initialized Error: PASSED"); }

async function testValidRequestF01GetChartBasics() { /* ... same structure, updated assertions ... */ 
  console.log('\nRunning Test: Valid Request MCP-F01 (Get_Chart_Basics)...');
  const requestId = "test-f01-valid-004";
  const initReq = initRequestLine(requestId + "_init");
  const getChartBasicsReq = JSON.stringify({ requestId, toolId: "Get_Chart_Basics", params: {} });
  const processOutput = await runServerProcess([initReq, getChartBasicsReq], 2);
  expect(processOutput.stdout).toHaveLength(2);
  const initResponse = JSON.parse(processOutput.stdout[0]);
  expect(initResponse.data.success).toBe(true);
  const response = JSON.parse(processOutput.stdout[1]); 
  expect(response.requestId).toBe(requestId);
  expect(response.status).toBe("success");
  expect(response.data).toBeDefined();
  expect(response.data.birthDate).toBe(validInitParams.birthDate);
  expect(typeof response.data.birthTime).toBe("string");
  expect(Object.values(Gender)).toContain(response.data.gender);
  expect(Object.values(WuXingJu)).toContain(response.data.wuXingJu);
  expect(Object.values(DiZhi)).toContain(response.data.mingGongDiZhi);
  console.log("Test Valid Request MCP-F01: PASSED");
}

// MCP-A03 Store_Star_Combination_Meaning Tests
async function testStoreCombinationSuccess() {
  console.log('\nRunning Test: MCP-A03 Store Combination Success...');
  const requestId = "test-a03-success-010";
  const params: StoreStarCombinationMeaningInputParams = {
    combinationName: "TestCombo1",
    jsCode: "return astrolabe.gender === '男';",
    meaning: "This chart belongs to a male.",
    relatedCharts: ["ChartX", "ChartY"]
  };
  const inputLine = JSON.stringify({ requestId, toolId: "MCP-A03", params });
  const processOutput = await runServerProcess([inputLine], 1);

  expect(processOutput.stdout).toHaveLength(1);
  const response = JSON.parse(processOutput.stdout[0]);
  expect(response.requestId).toBe(requestId);
  expect(response.status).toBe("success");
  expect(response.data.success).toBe(true);
  expect(typeof response.data.id).toBe("string");
  expect(response.data.id.length).toBeGreaterThan(0);
  expect(Array.isArray(response.data.messages)).toBe(true);
  expect(response.data.messages).toHaveLength(3); // Updated to 3 messages
  console.log("Test MCP-A03 Store Combination Success: PASSED");
}

async function testStoreCombinationInvalidParams() {
  console.log('\nRunning Test: MCP-A03 Store Combination Invalid Params...');
  const baseRequestId = "test-a03-invalid-011";
  const validParams: StoreStarCombinationMeaningInputParams = { combinationName: "Valid", jsCode: "return true;", meaning: "Valid meaning" };

  const testCases = [
    { name: "Missing combinationName", params: { ...validParams, combinationName: "" }, errorMsg: "combinationName must be a non-empty string" },
    { name: "Missing jsCode", params: { ...validParams, jsCode: "" }, errorMsg: "jsCode must be a non-empty string" },
    { name: "Missing meaning", params: { ...validParams, meaning: "" }, errorMsg: "meaning must be a non-empty string" },
    { name: "Invalid relatedCharts (not array)", params: { ...validParams, relatedCharts: "not-an-array" as any }, errorMsg: "relatedCharts must be an array of strings" },
    { name: "Invalid relatedCharts (array of non-string)", params: { ...validParams, relatedCharts: [123 as any] }, errorMsg: "relatedCharts must be an array of strings" },
  ];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const requestId = `${baseRequestId}-${i}`;
    console.log(`  Sub-test: ${tc.name}`);
    const inputLine = JSON.stringify({ requestId, toolId: "MCP-A03", params: tc.params });
    const processOutput = await runServerProcess([inputLine], 1);
    expect(processOutput.stdout).toHaveLength(1);
    const response = JSON.parse(processOutput.stdout[0]);
    expect(response.requestId).toBe(requestId);
    expect(response.status).toBe("error");
    expect(response.error.code).toBe("INVALID_PARAMS");
    expect(response.error.message).toContain(tc.errorMsg);
  }
  console.log("Test MCP-A03 Store Combination Invalid Params: PASSED");
}

// Automatic Combination Execution Tests
async function testAutoExecuteMatchingCombination() {
  console.log('\nRunning Test: Auto Execute Matching Combination...');
  const reqId1 = "auto-match-store1-012";
  const reqId2 = "auto-match-store2-013";
  const reqIdInit = "auto-match-init-014";

  const combo1Params: StoreStarCombinationMeaningInputParams = { combinationName: "Male Chart Match", jsCode: "return currentAstrolabe.gender === '男';", meaning: "Gender is Male" };
  const combo2Params: StoreStarCombinationMeaningInputParams = { combinationName: "Female Chart Match", jsCode: "return currentAstrolabe.gender === '女';", meaning: "Gender is Female" };

  const storeReq1 = JSON.stringify({ requestId: reqId1, toolId: "MCP-A03", params: combo1Params });
  const storeReq2 = JSON.stringify({ requestId: reqId2, toolId: "MCP-A03", params: combo2Params });
  const initReq = JSON.stringify({ requestId: reqIdInit, toolId: "MCP-SYS-01", params: { ...validInitParams, gender: "男" } }); // Initialize Male chart

  const processOutput = await runServerProcess([storeReq1, storeReq2, initReq], 3);
  expect(processOutput.stdout).toHaveLength(3);

  const storeRes1 = JSON.parse(processOutput.stdout[0]);
  const combo1Id = storeRes1.data.id;
  const storeRes2 = JSON.parse(processOutput.stdout[1]); // combo2Id not needed for positive assertion

  const initResponse = JSON.parse(processOutput.stdout[2]);
  expect(initResponse.requestId).toBe(reqIdInit);
  expect(initResponse.status).toBe("success");
  expect(initResponse.data.success).toBe(true);
  expect(Array.isArray(initResponse.data.matchedCombinations)).toBe(true);
  expect(initResponse.data.matchedCombinations).toHaveLength(1);
  
  const matchedCombo = initResponse.data.matchedCombinations[0];
  expect(matchedCombo.name).toBe("Male Chart Match");
  expect(matchedCombo.meaning).toBe("Gender is Male");
  expect(matchedCombo.id).toBe(combo1Id);
  console.log("Test Auto Execute Matching Combination: PASSED");
}

async function testAutoExecuteNoMatch() {
  console.log('\nRunning Test: Auto Execute No Match...');
  const reqIdStore = "auto-nomatch-store-015";
  const reqIdInit = "auto-nomatch-init-016";
  const comboParams: StoreStarCombinationMeaningInputParams = { combinationName: "NonMatchingTest", jsCode: "return false;", meaning: "Always false" };
  const storeReq = JSON.stringify({ requestId: reqIdStore, toolId: "MCP-A03", params: comboParams });
  const initReq = initRequestLine(reqIdInit); // Default init (male chart)

  const processOutput = await runServerProcess([storeReq, initReq], 2);
  expect(processOutput.stdout).toHaveLength(2);
  const initResponse = JSON.parse(processOutput.stdout[1]);
  expect(initResponse.requestId).toBe(reqIdInit);
  expect(initResponse.status).toBe("success");
  expect(initResponse.data.success).toBe(true);
  expect(initResponse.data.matchedCombinations).toBeUndefined(); // Or empty array
  console.log("Test Auto Execute No Match: PASSED");
}

async function testAutoExecuteJsCodeError() {
  console.log('\nRunning Test: Auto Execute JS Code Error...');
  const reqIdStore = "auto-jserror-store-017";
  const reqIdInit = "auto-jserror-init-018";
  const comboParams: StoreStarCombinationMeaningInputParams = { combinationName: "JsErrorTest", jsCode: "return someUndefinedVariable.error;", meaning: "Causes runtime error" };
  const storeReq = JSON.stringify({ requestId: reqIdStore, toolId: "MCP-A03", params: comboParams });
  const initReq = initRequestLine(reqIdInit);

  const processOutput = await runServerProcess([storeReq, initReq], 2);
  expect(processOutput.stdout).toHaveLength(2);
  const initResponse = JSON.parse(processOutput.stdout[1]);
  expect(initResponse.requestId).toBe(reqIdInit);
  expect(initResponse.status).toBe("success");
  expect(initResponse.data.success).toBe(true);
  expect(initResponse.data.matchedCombinations).toBeUndefined(); // Or empty array
  
  const stderrOutput = processOutput.stderr.join('\n');
  expect(stderrOutput).toContain("[Sandbox Execution Error]");
  expect(stderrOutput).toContain("someUndefinedVariable is not defined"); // Or similar
  console.log("Test Auto Execute JS Code Error: PASSED");
}

async function testAutoExecuteSandboxSecurity() {
  console.log('\nRunning Test: Auto Execute Sandbox Security (process.exit)...');
  const reqIdStore = "auto-sandbox-store-019";
  const reqIdInit = "auto-sandbox-init-020";
  const comboParams: StoreStarCombinationMeaningInputParams = { combinationName: "SandboxExitTest", jsCode: "process.exit(1);", meaning: "Tries to exit" };
  const storeReq = JSON.stringify({ requestId: reqIdStore, toolId: "MCP-A03", params: comboParams });
  const initReq = initRequestLine(reqIdInit);

  const processOutput = await runServerProcess([storeReq, initReq], 2);
  expect(processOutput.stdout).toHaveLength(2); // Server should not crash
  const initResponse = JSON.parse(processOutput.stdout[1]);
  expect(initResponse.requestId).toBe(reqIdInit);
  expect(initResponse.status).toBe("success"); // Chart init itself succeeds
  expect(initResponse.data.success).toBe(true);
  expect(initResponse.data.matchedCombinations).toBeUndefined(); // The malicious code should fail and not match

  const stderrOutput = processOutput.stderr.join('\n');
  expect(stderrOutput).toContain("[Sandbox Execution Error]");
  // vm2 might throw "process is not defined" or a more specific security error
  expect(stderrOutput.toLowerCase()).toContain("process is not defined"); 
  console.log("Test Auto Execute Sandbox Security: PASSED");
}


// A-Series Updated Status Tests
async function testA01QueryAstrologicalPatternNotFound() { /* ... same as before ... */ console.log('\nRunning Test: MCP-A01 Query_Astrological_Pattern (Tool Not Found)...'); const requestId = "test-a01-notfound-008"; const initReq = initRequestLine(requestId + "_init"); const a01Req = JSON.stringify({ requestId, toolId: "Query_Astrological_Pattern", params: { chartContext: {} } }); const processOutput = await runServerProcess([initReq, a01Req], 2); expect(processOutput.stdout).toHaveLength(2); const response = JSON.parse(processOutput.stdout[1]); expect(response.requestId).toBe(requestId); expect(response.status).toBe("error"); expect(response.error.code).toBe("TOOL_NOT_FOUND"); console.log("Test MCP-A01 Not Found: PASSED"); }
async function testA02QueryStarCombinationMeaningNotImplemented() { /* ... same as before ... */ console.log('\nRunning Test: MCP-A02 Query_Star_Combination_Meaning (Not Implemented)...'); const requestId = "test-a02-notimplemented-009"; const initReq = initRequestLine(requestId + "_init"); const params = { stars: ["紫微", "天府"], contextDescription: "in Ming Palace" }; const a02Req = JSON.stringify({ requestId, toolId: "Query_Star_Combination_Meaning", params }); const processOutput = await runServerProcess([initReq, a02Req], 2); expect(processOutput.stdout).toHaveLength(2); const response = JSON.parse(processOutput.stdout[1]); expect(response.requestId).toBe(requestId); expect(response.status).toBe("error"); expect(response.error.code).toBe("NOT_IMPLEMENTED"); expect(response.error.message).toContain("Feature not implemented"); console.log("Test MCP-A02 Not Implemented: PASSED"); }


// --- Main Test Execution ---
async function runAllAvailableTests() {
  const tests = [
    testMalformedJSON,
    testUnknownToolId,
    testInitializeChartSuccess,
    testInitializeChartInvalidParams,
    testChartNotInitializedError,
    testValidRequestF01GetChartBasics, // Sample F-series test post-init
    testStoreCombinationSuccess,
    testStoreCombinationInvalidParams,
    testAutoExecuteMatchingCombination,
    testAutoExecuteNoMatch,
    testAutoExecuteJsCodeError,
    testAutoExecuteSandboxSecurity,
    testA01QueryAstrologicalPatternNotFound,
    testA02QueryStarCombinationMeaningNotImplemented,
  ];
  let allPassed = true;

  for (const test of tests) {
    try {
      await test();
    } catch (error: any) {
      allPassed = false;
      console.error(`\nTest FAILED: ${test.name}`);
      console.error("Error:", error.message);
      if (error.stack) { console.error(error.stack); }
    }
  }

  if (allPassed) {
    console.log("\nAll mcp-server-stdio.ts integration tests PASSED!");
  } else {
    console.error("\nSome mcp-server-stdio.ts integration tests FAILED.");
    process.exit(1);
  }
}

if (require.main === module) {
  if (commandToExecute === 'ts-node' || require('fs').existsSync(scriptToExecute)) {
    console.log(`Attempting to run tests using ${commandToExecute} for ${scriptToExecute}...`);
    runAllAvailableTests();
  } else {
    console.error(`ERROR: Cannot run tests. Server script not found at ${scriptToExecute}.`);
    console.error("Please ensure mcp-server-stdio.ts is compiled to .js or ts-node is available and configured.");
    process.exit(1);
  }
}

export { runAllAvailableTests as runAllTests }; // Exporting for potential external runner
