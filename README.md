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
