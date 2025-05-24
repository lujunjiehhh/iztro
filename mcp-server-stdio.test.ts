/**
 * @file mcp-server-stdio.test.ts
 * @description Unit tests for mcp-server-stdio.ts using child_process.
 */

import * as child_process from 'child_process';
import * as path from 'path';
import { 
    PalaceName, DiZhi, TianGan, StarType, Gender, WuXingJu, SiHuaType, ChartLevel, 
    BrightnessLevel, WuXing, YinYang, BasicLuck
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

    serverProcess.stdout.on('data', (data) => {
      const lines = data.toString().trim().split('\n').filter((line: string) => line.trim() !== '');
      lines.forEach(line => {
        try { JSON.parse(line); output.stdout.push(line); outputLinesReceived++; } // Store only valid JSON lines
        catch (e) { console.warn("Non-JSON stdout line ignored:", line); }
      });
      if (allInputSent && outputLinesReceived >= expectedOutputLines) {
        if (!serverProcess.killed) serverProcess.kill();
      }
    });

    serverProcess.stderr.on('data', (data) => { output.stderr.push(...data.toString().trim().split('\n')); });
    serverProcess.on('error', (err) => { console.error("Test Harness: Failed to start server process.", err); reject(err); });
    serverProcess.on('exit', (code) => { output.exitCode = code; resolve(output); });

    inputLines.forEach(line => { serverProcess.stdin.write(line + '\n'); });
    serverProcess.stdin.end();
    allInputSent = true;
    if (outputLinesReceived >= expectedOutputLines && !serverProcess.killed) { // Check if already received enough
        serverProcess.kill();
    }
    
    setTimeout(() => {
        if (!serverProcess.killed) serverProcess.kill();
        reject(new Error(`Test timed out after 5000ms waiting for ${expectedOutputLines} lines. Received ${outputLinesReceived}. Stdout: ${output.stdout.join('\\n')}. Stderr: ${output.stderr.join('\\n')}`));
    }, 5000); // Increased timeout for potentially slower iztro integration
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
  toBeType: (expectedType: "string" | "number" | "boolean" | "object" | "array" | "function") => { 
    if (expectedType === "array") { if (!Array.isArray(actual)) { throw new Error(`AssertionError: Expected type array but got ${typeof actual}`); } }
    else if (typeof actual !== expectedType) { throw new Error(`AssertionError: Expected type ${expectedType} but got ${typeof actual}`); } 
  },
  toBeOneOf: (expectedValues: any[]) => { if (!expectedValues.includes(actual)) { throw new Error(`AssertionError: Expected ${JSON.stringify(actual)} to be one of ${JSON.stringify(expectedValues)}`); } },
});

// --- Test Data ---
const validInitParams = { birthDate: "1990-03-15", birthTimeIndex: 5, gender: "男", isLunar: false, fixLeap: true };
const initRequestLine = (requestId: string) => JSON.stringify({ requestId, toolId: "MCP-SYS-01", params: validInitParams });

// --- Test Cases ---
async function testMalformedJSON() { /* ... same as before ... */ 
  console.log('\nRunning Test: Malformed JSON Input...');
  const inputLine = "this is not valid json";
  const processOutput = await runServerProcess([inputLine], 1);
  expect(processOutput.stdout).toHaveLength(1);
  const response = JSON.parse(processOutput.stdout[0]);
  expect(response.status).toBe("error");
  expect(response.error.code).toBe("PROCESSING_ERROR"); 
  expect(response.error.message).toContain("Request is not a valid MCP request object");
  console.log("Test Malformed JSON Input: PASSED");
}
async function testUnknownToolId() { /* ... same as before ... */ 
  console.log('\nRunning Test: Unknown Tool ID...');
  const requestId = "test-unknown-tool-001";
  const inputLine = JSON.stringify({ requestId, toolId: "MCP-XYZ-UnknownTool", params: {} });
  const processOutput = await runServerProcess([inputLine], 1);
  expect(processOutput.stdout).toHaveLength(1);
  const response = JSON.parse(processOutput.stdout[0]);
  expect(response.requestId).toBe(requestId);
  expect(response.status).toBe("error");
  expect(response.error.code).toBe("TOOL_NOT_FOUND");
  expect(response.error.message).toContain("MCP-XYZ-UnknownTool");
  console.log("Test Unknown Tool ID: PASSED");
}

async function testInitializeChartSuccess() {
  console.log('\nRunning Test: Initialize Chart Success...');
  const requestId = "test-init-success-001";
  const processOutput = await runServerProcess([initRequestLine(requestId)], 1);
  expect(processOutput.stdout).toHaveLength(1);
  const response = JSON.parse(processOutput.stdout[0]);
  expect(response.requestId).toBe(requestId);
  expect(response.status).toBe("success");
  expect(response.data).toBeDefined();
  expect(response.data.success).toBe(true);
  console.log("Test Initialize Chart Success: PASSED");
}

async function testInitializeChartInvalidParams() {
  console.log('\nRunning Test: Initialize Chart Invalid Params...');
  const requestId = "test-init-invalid-002";
  const invalidParams = { ...validInitParams, birthTimeIndex: 99 };
  const inputLine = JSON.stringify({ requestId, toolId: "MCP-SYS-01", params: invalidParams });
  const processOutput = await runServerProcess([inputLine], 1);
  expect(processOutput.stdout).toHaveLength(1);
  const response = JSON.parse(processOutput.stdout[0]);
  expect(response.requestId).toBe(requestId);
  expect(response.status).toBe("error");
  expect(response.error.code).toBe("INVALID_PARAMS");
  expect(response.error.message).toContain("birthTimeIndex must be between 0 and 12");
  console.log("Test Initialize Chart Invalid Params: PASSED");
}

async function testChartNotInitializedError() {
  console.log('\nRunning Test: Chart Not Initialized Error...');
  const requestId = "test-no-init-003";
  const inputLine = JSON.stringify({ requestId, toolId: "Get_Chart_Basics", params: {} }); // No init call first
  const processOutput = await runServerProcess([inputLine], 1);
  expect(processOutput.stdout).toHaveLength(1);
  const response = JSON.parse(processOutput.stdout[0]);
  expect(response.requestId).toBe(requestId);
  expect(response.status).toBe("error");
  expect(response.error.code).toBe("CHART_NOT_INITIALIZED");
  expect(response.error.message).toContain("Chart not initialized");
  console.log("Test Chart Not Initialized Error: PASSED");
}

async function testValidRequestF01GetChartBasics() {
  console.log('\nRunning Test: Valid Request MCP-F01 (Get_Chart_Basics)...');
  const requestId = "test-f01-valid-004";
  const initReq = initRequestLine(requestId + "_init");
  const getChartBasicsReq = JSON.stringify({ requestId, toolId: "Get_Chart_Basics", params: {} });
  const processOutput = await runServerProcess([initReq, getChartBasicsReq], 2);
  
  expect(processOutput.stdout).toHaveLength(2);
  const response = JSON.parse(processOutput.stdout[1]); // Second response is for Get_Chart_Basics

  expect(response.requestId).toBe(requestId);
  expect(response.status).toBe("success");
  expect(response.data).toBeDefined();
  expect(response.data.birthDate).toBe(validInitParams.birthDate);
  expect(typeof response.data.birthTime).toBe("string");
  expect(Object.values(Gender)).toContain(response.data.gender);
  expect(Object.values(WuXingJu)).toContain(response.data.wuXingJu);
  expect(Object.values(DiZhi)).toContain(response.data.mingGongDiZhi);
  expect(Object.values(DiZhi)).toContain(response.data.shenGongDiZhi);
  expect(Object.values(PalaceName)).toContain(response.data.shenGongPalace);
  console.log("Test Valid Request MCP-F01: PASSED");
}

async function testValidRequestF02GetPalaceInfo() {
    console.log('\nRunning Test: Valid Request MCP-F02 (Get_Palace_Info)...');
    const requestId = "test-f02-valid-005";
    const initReq = initRequestLine(requestId + "_init");
    const params = { palaceName: PalaceName.Ming };
    const getPalaceInfoReq = JSON.stringify({ requestId, toolId: "Get_Palace_Info", params });
    const processOutput = await runServerProcess([initReq, getPalaceInfoReq], 2);

    expect(processOutput.stdout).toHaveLength(2);
    const response = JSON.parse(processOutput.stdout[1]);

    expect(response.requestId).toBe(requestId);
    expect(response.status).toBe("success");
    expect(response.data).toBeDefined();
    expect(response.data.palaceName).toBe(PalaceName.Ming);
    expect(Object.values(DiZhi)).toContain(response.data.palaceDiZhi);
    expect(Object.values(TianGan)).toContain(response.data.palaceTianGan);
    expect(typeof response.data.coreMeaning).toBe("string");
    console.log("Test Valid Request MCP-F02: PASSED");
}

async function testValidRequestR01GetSanFangSiZheng() {
    console.log('\nRunning Test: Valid Request MCP-R01 (Get_SanFang_SiZheng)...');
    const requestId = "test-r01-valid-006";
    const initReq = initRequestLine(requestId + "_init");
    const params = { referencePalaceIdentifier: PalaceName.Ming };
    const getSFSZReq = JSON.stringify({ requestId, toolId: "Get_SanFang_SiZheng", params });
    const processOutput = await runServerProcess([initReq, getSFSZReq], 2);

    expect(processOutput.stdout).toHaveLength(2);
    const response = JSON.parse(processOutput.stdout[1]);
    expect(response.requestId).toBe(requestId);
    expect(response.status).toBe("success");
    expect(response.data).toBeDefined();
    expect(response.data.referencePalace).toBeDefined();
    expect(Object.values(PalaceName)).toContain(response.data.referencePalace.name);
    expect(Array.isArray(response.data.sanFangPalaces)).toBe(true);
    expect(response.data.sanFangPalaces).toHaveLength(3);
    response.data.sanFangPalaces.forEach((p: any) => {
        expect(Object.values(PalaceName)).toContain(p.name);
        expect(Object.values(DiZhi)).toContain(p.diZhi);
        expect(Object.values(TianGan)).toContain(p.tianGan);
    });
    expect(response.data.siZhengPalace).toBeDefined();
    console.log("Test Valid Request MCP-R01: PASSED");
}

async function testValidRequestT01GetDecadeInfo() {
    console.log('\nRunning Test: Valid Request MCP-T01 (Get_Decade_Info)...');
    const requestId = "test-t01-valid-007";
    const initReq = initRequestLine(requestId + "_init"); // Using birthDate 1990-03-15
    const params = { userAge: 33 }; // Example age
    const getDecadeReq = JSON.stringify({ requestId, toolId: "Get_Decade_Info", params });
    const processOutput = await runServerProcess([initReq, getDecadeReq], 2);

    expect(processOutput.stdout).toHaveLength(2);
    const response = JSON.parse(processOutput.stdout[1]);
    expect(response.requestId).toBe(requestId);
    expect(response.status).toBe("success");
    expect(response.data).toBeDefined();
    expect(typeof response.data.decadeStartAge).toBe("number");
    expect(typeof response.data.decadeEndAge).toBe("number");
    expect(response.data.decadeMingGong).toBeDefined();
    expect(Object.values(TianGan)).toContain(response.data.decadeMingGongTianGan);
    expect(Array.isArray(response.data.decadePalaces)).toBe(true);
    expect(response.data.decadePalaces).toHaveLength(12);
    response.data.decadePalaces.forEach((dp: any) => {
        expect(typeof dp.timePalaceName).toBe("string");
        expect(Object.values(PalaceName)).toContain(dp.natalPalaceName);
        expect(Object.values(TianGan)).toContain(dp.timePalaceTianGan);
        expect(Object.values(DiZhi)).toContain(dp.timePalaceDiZhi);
    });
    console.log("Test Valid Request MCP-T01: PASSED");
}

async function testA01QueryAstrologicalPatternNotFound() {
  console.log('\nRunning Test: MCP-A01 Query_Astrological_Pattern (Tool Not Found)...');
  const requestId = "test-a01-notfound-008";
  const initReq = initRequestLine(requestId + "_init");
  const a01Req = JSON.stringify({ requestId, toolId: "Query_Astrological_Pattern", params: { chartContext: {} } });
  const processOutput = await runServerProcess([initReq, a01Req], 2);

  expect(processOutput.stdout).toHaveLength(2);
  const response = JSON.parse(processOutput.stdout[1]);
  expect(response.requestId).toBe(requestId);
  expect(response.status).toBe("error");
  expect(response.error.code).toBe("TOOL_NOT_FOUND");
  console.log("Test MCP-A01 Not Found: PASSED");
}

async function testA02QueryStarCombinationMeaningNotImplemented() {
  console.log('\nRunning Test: MCP-A02 Query_Star_Combination_Meaning (Not Implemented)...');
  const requestId = "test-a02-notimplemented-009";
  const initReq = initRequestLine(requestId + "_init");
  const params = { stars: ["紫微", "天府"], contextDescription: "in Ming Palace" };
  const a02Req = JSON.stringify({ requestId, toolId: "Query_Star_Combination_Meaning", params });
  const processOutput = await runServerProcess([initReq, a02Req], 2);

  expect(processOutput.stdout).toHaveLength(2);
  const response = JSON.parse(processOutput.stdout[1]);
  expect(response.requestId).toBe(requestId);
  expect(response.status).toBe("error");
  expect(response.error.code).toBe("NOT_IMPLEMENTED");
  expect(response.error.message).toContain("Feature not implemented");
  console.log("Test MCP-A02 Not Implemented: PASSED");
}


// --- Main Test Execution ---
async function runAllAvailableTests() {
  const tests = [
    testMalformedJSON,
    testUnknownToolId,
    testInitializeChartSuccess,
    testInitializeChartInvalidParams,
    testChartNotInitializedError,
    testValidRequestF01GetChartBasics,
    testValidRequestF02GetPalaceInfo, // Re-using F02 as an example of data access post-init
    testValidRequestR01GetSanFangSiZheng,
    testValidRequestT01GetDecadeInfo,
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
