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
*   Definitions for querying astrological patterns (格局) and star combination meanings.

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

A reference implementation of an MCP server that communicates over standard input/output (stdio) is provided in `mcp-server-stdio.ts`.

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
*   `toolId` (string): The ID of the MCP tool to execute (e.g., "Get_Chart_Basics", "Get_Palace_Info"). Note: The prompt examples for `toolId` like "MCP-F01" might differ from the actual string IDs used in the server implementation (e.g., "Get_Chart_Basics"). Refer to the `switch` statement in `mcp-server-stdio.ts` for the exact `toolId` strings.
*   `params` (object): An object containing the parameters for the specified tool. The structure of `params` must match the input type defined for that tool in `mcp-tools.ts`.

*Example Request (for Get_Palace_Info):*
```json
{"requestId": "req-001", "toolId": "Get_Palace_Info", "params": {"palaceName": "Ming"}}
```

**Response Format:**
Each response will be a JSON object with the following properties:
*   `requestId` (string): The identifier from the original request.
*   `status` (string): Either "success" or "error".
*   `data` (object, optional): If `status` is "success", this field contains the tool's result, conforming to the output type in `mcp-tools.ts`.
*   `error` (object, optional): If `status` is "error", this field contains:
    *   `message` (string): Description of the error.
    *   `code` (string, optional): An error code (e.g., "INVALID_JSON", "TOOL_NOT_FOUND", "INVALID_PARAMS").

*Example Success Response (for Get_Palace_Info, assuming "Ming" was requested):*
```json
{"requestId":"req-001","status":"success","data":{"palaceName":"Ming","palaceDiZhi":"Yin","palaceTianGan":"Jia","coreMeaning":"Mocked core meaning for Ming (JiaYin)"}}
```

*Example Error Response:*
```json
{"requestId": "req-002", "status": "error", "error": {"message": "Tool ID 'MCP-XYZ' not found or not yet implemented.", "code": "TOOL_NOT_FOUND"}}
```

### Available Tools

The server currently provides mocked responses for all tools defined in `mcp-tools.ts` (MCP-F, MCP-R, MCP-T, and MCP-A series). Refer to `mcp-tools.ts` for details on each tool's expected `params` and `data` structure, and to the `switch` statement in `mcp-server-stdio.ts` for the exact string `toolId`s.

### Running Tests

Basic unit tests for the stdio server are available in `mcp-server-stdio.test.ts`. These tests can be executed after compilation:
```bash
node mcp-server-stdio.test.js
```
The tests use a `child_process` approach to interact with the server and verify its behavior against various scenarios. Ensure `mcp-server-stdio.js` is present in the same directory (or adjust paths in the test file if using `ts-node` or a different build output structure).
