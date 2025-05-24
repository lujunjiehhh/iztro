# MCP Tools for Zi Wei Dou Shu LLM Integration

This repository contains the `mcp-tools.ts` file, which defines a set of TypeScript interfaces and types. These definitions serve as the Model Context Protocol (MCP) for an application where a Large Language Model (LLM) interacts with a Zi Wei Dou Shu (紫微斗数) backend calculation engine named "iztro".

## Purpose

The primary purpose of these TypeScript definitions is to provide a standardized data structure for the information exchanged between the LLM and the `iztro` backend. By adhering to these interfaces, the LLM can:

*   Request specific astrological chart data from `iztro`.
*   Receive this data in a predictable, well-typed format.
*   Utilize this structured data to perform complex interpretations and reasoning based on Zi Wei Dou Shu principles.

The `iztro` backend is responsible for all the core astrological calculations and providing data according to these MCP definitions. The LLM then uses this data as context for its analysis and user interaction.

## Structure of `mcp-tools.ts`

The `mcp-tools.ts` file includes TypeScript definitions for various aspects of a Zi Wei Dou Shu chart, such as:

*   Basic chart information (birth details, gender, etc.)
*   Palace (宫位) details
*   Star (星曜) attributes and their locations
*   SiHua (四化) stars (Natal, Decade, Annual, Flying)
*   Relationships between palaces (San Fang Si Zheng, An He, etc.)
*   Temporal data for Decades (大限) and Annual (流年) periods
*   Overlapping palace information across different time layers
*   Definitions for querying astrological patterns (格局) and star combination meanings, and for storing custom combination definitions.

Each definition is accompanied by JSDoc comments explaining its purpose and the meaning of its properties, especially for terms specific to Zi Wei Dou Shu.

## Usage

These type definitions are intended to be used in a TypeScript-based environment where the LLM's interaction logic is developed. They can be imported and used to ensure type safety and clarity when processing data from the `iztro` backend.

Example (conceptual):

```typescript
// In the LLM's interaction logic
import { GetPalaceInfoFunctionOutput, PalaceName } from './mcp-tools';

async function getPalaceDetails(palaceName: PalaceName): Promise<GetPalaceInfoFunctionOutput> {
  // Logic to call the iztro backend API endpoint corresponding to Get_Palace_Info
  const data = await iztroApi.getPalaceInfo(palaceName);
  return data as GetPalaceInfoFunctionOutput; // Ensure data conforms to the defined type
}

// Usage
const mingGongInfo = await getPalaceDetails(PalaceName.MingGong);
if (mingGongInfo && !Array.isArray(mingGongInfo)) {
  console.log(`Ming Gong Tian Gan: ${mingGongInfo.palaceTianGan}`);
}
```

This setup facilitates a clear separation of concerns: `iztro` handles the complex astrological calculations, and the LLM focuses on interpretation, leveraging the structured data provided via these MCP tools.

## Stdio MCP Server (`mcp-server-stdio.ts`)

A reference implementation of an MCP server that communicates over standard input/output (stdio) is provided in `mcp-server-stdio.ts`. **This server now integrates with the `iztro` TypeScript library (from the `src` directory) to provide actual astrological data for the F-series, R-series, and T-series tools.**

### Building and Running

1.  **Prerequisites:**
    *   Node.js and npm/yarn installed.
    *   TypeScript installed (`npm install -g typescript` or similar).

2.  **Compilation:**
    Navigate to the root directory of this project and compile the TypeScript files:
    ```bash
    tsc
    ```
    This will generate JavaScript files (e.g., `mcp-server-stdio.js` and `mcp-tools.js`) in the same directory or as per your `tsconfig.json` configuration.

3.  **Execution:**
    Run the compiled server using Node.js:
    ```bash
    node mcp-server-stdio.js
    ```
    The server will then wait for JSON requests on stdin.

### Interaction Protocol

The server expects requests and sends responses as single-line JSON objects.

**Request Format:**
Each request must be a JSON object with the following properties:
*   `requestId` (string): A unique identifier for the request. This ID will be present in the corresponding response.
*   `toolId` (string): The ID of the MCP tool to execute (e.g., "MCP-SYS-01", "Get_Chart_Basics"). Refer to the `switch` statement in `mcp-server-stdio.ts` for the exact `toolId` strings.
*   `params` (object): An object containing the parameters for the specified tool.

**Response Format:**
Each response will be a JSON object with the following properties:
*   `requestId` (string): The identifier from the original request.
*   `status` (string): Either "success" or "error".
*   `data` (object, optional): If `status` is "success", this field contains the tool's result.
*   `error` (object, optional): If `status` is "error", this field contains:
    *   `message` (string): Description of the error.
    *   `code` (string, optional): An error code (e.g., "INVALID_JSON", "TOOL_NOT_FOUND", "INVALID_PARAMS", "CHART_NOT_INITIALIZED", "NOT_IMPLEMENTED").

#### Chart Initialization (`MCP-SYS-01 Initialize_Chart`)

Before most other data-retrieval tools (F, R, T-series) can be used, the astrological chart must be initialized using the `MCP-SYS-01` tool.

**Purpose:** Initializes the astrological chart context within the server using the provided birth parameters. After successful initialization, it also automatically runs all stored star combination definitions (see MCP-A03) against the new chart and returns any matches.

**Request `params` for `MCP-SYS-01`:**
*   `birthDate` (string): The birth date in "YYYY-MM-DD" format.
*   `birthTimeIndex` (number): An index representing the birth time slot (0-12, where 0 is 23:00-00:59, 1 is 01:00-02:59, ..., 12 is 21:00-22:59).
*   `gender` (string): "男" for male, "女" for female.
*   `isLunar` (boolean, optional): `true` if `birthDate` is a lunar calendar date, `false` or omitted if solar. Defaults to `false` (solar).
*   `fixLeap` (boolean, optional): Whether to adjust for leap months in lunar calculations. Defaults to `true`.

*Example Request for `MCP-SYS-01 Initialize_Chart`*:
```json
{"requestId": "req-init", "toolId": "MCP-SYS-01", "params": {"birthDate": "1990-03-15", "birthTimeIndex": 5, "gender": "男", "isLunar": false}}
```

*Example Success Response for `MCP-SYS-01` (with a matched combination)*:
```json
{
  "requestId": "req-init-002",
  "status": "success",
  "data": {
    "success": true,
    "matchedCombinations": [
      {
        "name": "My Custom Pattern",
        "meaning": "Zi Wei in Ming Gong with Miao brightness indicates...",
        "id": "unique-combo-id-12345"
      }
      // ... other matched combinations if any
    ]
  }
}
```
If no combinations match, the `matchedCombinations` field will be `undefined` or an empty array. If initialization fails (e.g., invalid date), an error response will be returned.

#### Storing Star Combination Definitions (`MCP-A03 Store_Star_Combination_Meaning`)

This tool allows an LLM to define and store custom star combinations (or patterns/格局) for later evaluation.

**Purpose:** Stores a new star combination definition, including its name, JavaScript validation logic, a textual meaning, and optional references to example charts.

**Request `params` for `MCP-A03`:**
*   `combinationName` (string): A descriptive name for the combination (e.g., "禄马交驰格").
*   `jsCode` (string): A string of JavaScript code. This code should be the body of a function that returns `true` if the combination is present in the chart, and `false` otherwise.
*   `meaning` (string): A textual interpretation or meaning of this combination.
*   `relatedCharts` (string[], optional): An array of strings, typically IDs or descriptions of charts where this combination is known to be present, for reference or examples.

*Example Request for `MCP-A03 Store_Star_Combination_Meaning`*:
```json
{
  "requestId": "req-store-combo-001",
  "toolId": "MCP-A03",
  "params": {
    "combinationName": "My Custom Pattern",
    "jsCode": "return currentAstrolabe.palace('MingGong').hasStar('ZiWei') && currentAstrolabe.palace('MingGong').star('ZiWei').brightness === 'Miao';",
    "meaning": "Zi Wei in Ming Gong with Miao brightness indicates...",
    "relatedCharts": ["Example Case ID 123"]
  }
}
```

**`jsCode` Execution Environment:**
The provided `jsCode` is executed in a secure sandbox environment (`vm2`).
*   It should be written as the body of a function that returns a boolean value (`true` for match, `false` otherwise).
*   An `astrolabe` object (representing the current `FunctionalAstrolabe` instance from `iztro`) is available within the `jsCode`'s scope. This object provides access to the full chart data and `iztro`'s analytical methods.
*   A limited `console` object (`console.log`, `console.error`) is also available for logging from the sandboxed code; these logs will appear on the server's `stderr`.
*   Access to Node.js built-ins like `require`, `process`, `module`, and file system access is forbidden.

*Example Success Response for `MCP-A03`*:
```json
{
  "requestId": "req-store-combo-001",
  "status": "success",
  "data": {
    "success": true,
    "id": "unique-combo-id-12345",
    "messages": [
      "Star combination meaning stored successfully.",
      "You can now reference this combination by its ID when initializing charts.",
      "The jsCode will be executed against future charts to check for matches."
    ]
  }
}
```

#### Data Retrieval Tools

Once the chart is successfully initialized using `MCP-SYS-01`, other tools (F-series, R-series, T-series) can be called to get detailed chart information based on this initialized context.

*Example Request (for Get_Palace_Info after initialization):*
```json
{"requestId": "req-001", "toolId": "Get_Palace_Info", "params": {"palaceName": "Ming"}}
```

*Example Success Response (for Get_Palace_Info, assuming "Ming" was requested for an initialized chart):*
```json
{"requestId":"req-001","status":"success","data":{"palaceName":"命宫","palaceDiZhi":"寅","palaceTianGan":"甲","coreMeaning":"TODO: Core meaning for Ming"}}
```

### Available Tools

*   **`MCP-SYS-01 Initialize_Chart`**: Initializes the chart context and checks for stored combination matches.
*   **F-Series (Fundamental Chart Data)**: Tools like `Get_Chart_Basics`, `Get_Palace_Info`, `Get_Stars_In_Palace`, `Get_Star_Attributes`, `Get_Natal_SiHua`. These return actual data derived from the initialized `iztro` chart.
*   **R-Series (Relationship Analysis)**: Tools like `Get_SanFang_SiZheng`, `Get_AnHe_Palace`, `Get_ChongZhao_Palace`, `Get_Jia_Gong_Info`. These also use the initialized `iztro` chart.
*   **T-Series (Temporal Analysis)**: Tools like `Get_Decade_Info`, `Get_Annual_Info`, `Get_Decade_SiHua`, `Get_Annual_SiHua`, etc. These utilize `iztro`'s horoscope functionalities for time-based calculations.
*   **A-Series (Advanced Support)**:
    *   `Query_Astrological_Pattern` (MCP-A01): This tool has been **removed**. Requests for it will result in a `TOOL_NOT_FOUND` error.
    *   `Query_Star_Combination_Meaning` (MCP-A02): This tool is **not currently implemented** (TODO). Requests for it will result in a `NOT_IMPLEMENTED` error.
    *   `MCP-A03 Store_Star_Combination_Meaning`: Allows defining and storing custom star combination logic (see above).

Refer to `mcp-tools.ts` for details on each tool's expected `params` (if any, beyond initialization) and `data` structure, and to the `switch` statement in `mcp-server-stdio.ts` for the exact string `toolId`s.

### Running Tests

Basic unit tests for the stdio server are available in `mcp-server-stdio.test.ts`. These tests can be executed after compilation:
```bash
node mcp-server-stdio.test.js
```
The tests use a `child_process` approach to interact with the server and verify its behavior against various scenarios, including chart initialization, data retrieval, and storing/evaluating custom star combinations. Ensure `mcp-server-stdio.js` is present in the same directory (or adjust paths in the test file if using `ts-node` or a different build output structure).
