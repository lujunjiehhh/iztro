import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createRequire } from "node:module";
// Avoid importing from ../src directly at runtime.
// The server runs as ESM, while the library build output is CJS. We load the CJS build via require.
import type * as IztroTypes from "../lib/index.js";
import type { IFunctionalAstrolabe } from "../lib/astro/FunctionalAstrolabe.js";
import type { IFunctionalPalace } from "../lib/astro/FunctionalPalace.js";
import type { PalaceName, StarName } from "../lib/i18n/index.js";

const require = createRequire(import.meta.url);
// NOTE: This requires the library to be built first (yarn build) so ../lib/index.js exists.
const iztro = require("../lib/index.js") as typeof IztroTypes;

// --- State Management ---
// NOTE: Global state is used here for simplicity in a stdio-based MCP server where the process
// is typically 1-to-1 with the client. For multi-user HTTP servers, a session-based approach
// (e.g., Map<string, Astrolabe>) would be required.
let currentAstrolabe: IFunctionalAstrolabe | null = null;

// --- Helper Functions ---

/**
 * Ensures a chart is currently set. Throws error if not.
 */
function requireChart(): IFunctionalAstrolabe {
  if (!currentAstrolabe) {
    throw new Error(
      "No chart is currently active. Please use 'Get_Chart_Basics' first."
    );
  }
  return currentAstrolabe;
}

type ToolArgs = Record<string, unknown>;

/**
 * Validates that arguments object exists
 */
function validateArgs(args: unknown): ToolArgs {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    throw new Error('Invalid arguments: Expected an object.');
  }

  return args as ToolArgs;
}

function getPalaces(chart: IFunctionalAstrolabe): IFunctionalPalace[] {
  return chart.palaces as unknown as IFunctionalPalace[];
}

/**
 * Resolve the soul (life) palace without hardcoding locale-specific palace names.
 * We instead match by the chart's `earthlyBranchOfSoulPalace`, which is already localized
 * consistently with each palace's `earthlyBranch`.
 */
function getSoulPalace(chart: IFunctionalAstrolabe): IFunctionalPalace | undefined {
  return getPalaces(chart).find((p) => p.earthlyBranch === chart.earthlyBranchOfSoulPalace);
}

// --- Tool Implementations ---

// MCP-F01: Get_Chart_Basics
const getChartBasics = async (rawArgs: unknown) => {
  const args = (rawArgs ?? {}) as ToolArgs; // Handle null/undefined args safely

  const hasAnyChartArg = args.birthday || args.birthTime !== undefined || args.gender;

  if (hasAnyChartArg) {
      // Fix: Check for strictly valid birthTime (non-null number)
      if (!args.birthday || typeof args.birthTime !== 'number' || !args.gender) {
        throw new Error(
          'Incomplete chart arguments. To initialize or update the chart, you must provide all three: birthday, birthTime (number 0-12), and gender.',
        );
      }

      const birthday = String(args.birthday);
      const birthTime = Number(args.birthTime);
      const gender = String(args.gender);
      // Optional language: "zh-CN" | "zh-TW" | "en-US" | "ja-JP" | "ko-KR" | "vi-VN"
      const language = typeof args.language === 'string' ? args.language : undefined;
      currentAstrolabe = iztro.astro.bySolar(
        birthday,
        birthTime,
        gender === 'male' ? '男' : '女',
        true,
        language,
      );
  } else if (!currentAstrolabe) {
      throw new Error("Please provide birthday, birthTime (0-12), and gender (male/female) to initialize the chart.");
  }

  const chart = currentAstrolabe;

  const lifePalace = getSoulPalace(chart);

  // Body Palace is the one where isBodyPalace is true.
  const bodyPalace = getPalaces(chart).find((p) => p.isBodyPalace);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          gender: chart.gender,
          solarDate: chart.solarDate,
          lunarDate: chart.lunarDate,
          chineseDate: chart.chineseDate,
          fiveElementsClass: chart.fiveElementsClass,
          soulPalaceBranch: lifePalace?.earthlyBranch, // Life Palace Branch
          bodyPalaceBranch: bodyPalace?.earthlyBranch, // Body Palace Branch
          bodyPalaceLocation: bodyPalace?.name, // Body Palace Name (e.g. "Wealth")
          soulStar: chart.soul, // "Soul" (Ming Zhu) Star
          bodyStar: chart.body  // "Body" (Shen Zhu) Star
        }, null, 2),
      },
    ],
  };
};

// MCP-F02: Get_Palace_Info
const getPalaceInfo = async (rawArgs: unknown) => {
  const args = validateArgs(rawArgs);
  const chart = requireChart();
  const palaceName = args.palaceName;

  if (!palaceName) throw new Error("Argument 'palaceName' is required.");

  const palacesToReturn: IFunctionalPalace[] = [];

  if (palaceName === 'All') {
    palacesToReturn.push(...chart.palaces);
  } else {
    const p = chart.palace(String(palaceName) as PalaceName);
    if (p) palacesToReturn.push(p);
    else throw new Error(`Palace '${palaceName}' not found.`);
  }

  const result = palacesToReturn.map((p) => ({
    name: p.name,
    earthlyBranch: p.earthlyBranch,
    heavenlyStem: p.heavenlyStem,
  }));

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
};

// MCP-F03: Get_Stars_In_Palace
const getStarsInPalace = async (rawArgs: unknown) => {
  const args = validateArgs(rawArgs);
  const chart = requireChart();
  const palaceName = args.palaceName;

  if (!palaceName) throw new Error("Argument 'palaceName' is required.");

  const p = chart.palace(String(palaceName) as PalaceName);

  if (!p) throw new Error(`Palace '${palaceName}' not found.`);

  const stars = [
    ...p.majorStars,
    ...p.minorStars,
    ...p.adjectiveStars
  ].map((s) => ({
    name: s.name,
    type: s.type,
    mutagen: s.mutagen
  }));

  return {
    content: [{ type: "text", text: JSON.stringify(stars, null, 2) }],
  };
};

// MCP-F04: Get_Star_Attributes
const getStarAttributes = async (rawArgs: unknown) => {
  const args = validateArgs(rawArgs);
  const chart = requireChart();
  const starName = args.starName;

  if (!starName) throw new Error("Argument 'starName' is required.");

  const star = chart.star(String(starName) as StarName);

  if (!star) throw new Error(`Star '${starName}' not found in current chart.`);

  return {
    content: [{ type: "text", text: JSON.stringify({
      name: star.name,
      brightness: star.brightness,
      mutagen: star.mutagen,
    }, null, 2) }],
  };
};

// MCP-F05: Get_Natal_SiHua
const getNatalSiHua = async () => {
    const chart = requireChart();

    const siHuaMap: Record<string, unknown> = {};

    getPalaces(chart).forEach((p) => {
        [...p.majorStars, ...p.minorStars].forEach((s) => {
            if (s.mutagen) {
                siHuaMap[s.mutagen] = {
                    star: s.name,
                    palace: p.name,
                    type: s.mutagen
                };
            }
        });
    });

    return {
        content: [{ type: "text", text: JSON.stringify(siHuaMap, null, 2) }]
    };
};

// MCP-R01: Get_SanFang_SiZheng
const getSanFangSiZheng = async (rawArgs: unknown) => {
    const args = validateArgs(rawArgs);
    const chart = requireChart();
    const palaceName = args.palaceName;

    if (!palaceName) throw new Error("Argument 'palaceName' is required.");

    const surrounded = chart.surroundedPalaces(String(palaceName) as PalaceName);

    return {
        content: [{ type: "text", text: JSON.stringify({
            target: surrounded.target.name,
            opposite: surrounded.opposite.name,
            wealth: surrounded.wealth.name,
            career: surrounded.career.name
        }, null, 2) }]
    };
};

// MCP-R02: Get_AnHe_Palace
const getAnHePalace = async (rawArgs: unknown) => {
    const args = validateArgs(rawArgs);
    const chart = requireChart();
    const palaceName = args.palaceName;

    if (!palaceName) throw new Error("Argument 'palaceName' is required.");

    const p = chart.palace(String(palaceName) as PalaceName);
    if (!p) throw new Error("Palace not found");

    // Earthly Branch Liu He (Six Harmonies) - Structural Dark Join
    const branch = p.earthlyBranch;
    const branchPairs: Record<string, string> = {
        "子": "丑", "丑": "子",
        "寅": "亥", "亥": "寅",
        "卯": "戌", "戌": "卯",
        "辰": "酉", "酉": "辰",
        "巳": "申", "申": "巳",
        "午": "未", "未": "午"
    };
    const targetBranch = branchPairs[branch];
    const liuHePalace = getPalaces(chart).find((tp) => tp.earthlyBranch === targetBranch);

    // Heavenly Stem Gan He (Stem Combinations) - Motivational/Hidden Dark Join
    const stem = p.heavenlyStem;
    // Map simplified stems to their pairs: Jia-Ji, Yi-Geng, Bing-Xin, Ding-Ren, Wu-Gui
    const stemPairs: Record<string, string> = {
        "甲": "己", "己": "甲",
        "乙": "庚", "庚": "乙",
        "丙": "辛", "辛": "丙",
        "丁": "壬", "壬": "丁",
        "戊": "癸", "癸": "戊"
    };

    const targetStem = stemPairs[stem];
    const ganHePalaces = getPalaces(chart).filter((tp) => tp.heavenlyStem === targetStem);

    return {
        content: [{ type: "text", text: JSON.stringify({
            source: p.name,
            sourceBranch: branch,
            sourceStem: stem,

            // Earthly Branch AnHe (Liu He)
            liuHePalace: {
                name: liuHePalace?.name,
                branch: targetBranch
            },

            // Heavenly Stem AnHe (Gan He)
            ganHePalaces: ganHePalaces.map((gp) => ({
                name: gp.name,
                stem: gp.heavenlyStem
            })),

            // Legacy field for backward compatibility or simple view (preferring Liu He as "The" AnHe if forced to choose one, but returning both is better)
            anHePalace: liuHePalace?.name,
            anHeBranch: targetBranch

        }, null, 2) }]
    };
};

// MCP-R03: Get_ChongZhao_Palace
const getChongZhaoPalace = async (rawArgs: unknown) => {
    const args = validateArgs(rawArgs);
    const chart = requireChart();
    const palaceName = args.palaceName;

    if (!palaceName) throw new Error("Argument 'palaceName' is required.");

    const surrounded = chart.surroundedPalaces(String(palaceName) as PalaceName);

    return {
        content: [{ type: "text", text: JSON.stringify({
            source: palaceName,
            opposite: surrounded.opposite.name
        }, null, 2) }]
    };
};

// MCP-R04: Get_Jia_Gong_Info
const getJiaGongInfo = async (rawArgs: unknown) => {
    const args = validateArgs(rawArgs);
    const chart = requireChart();
    const palaceName = args.palaceName;

    if (!palaceName) throw new Error("Argument 'palaceName' is required.");

    const p = chart.palace(String(palaceName) as PalaceName);
    if (!p) throw new Error("Palace not found");

    const idx = p.index;
    const prevIdx = (idx - 1 + 12) % 12;
    const nextIdx = (idx + 1) % 12;

    const prevPalace = chart.palace(prevIdx);
    const nextPalace = chart.palace(nextIdx);

    return {
        content: [{ type: "text", text: JSON.stringify({
            source: p.name,
            previousPalace: {
                name: prevPalace?.name,
                stars: prevPalace?.majorStars.map((s) => s.name)
            },
            nextPalace: {
                name: nextPalace?.name,
                stars: nextPalace?.majorStars.map((s) => s.name)
            }
        }, null, 2) }]
    };
};


// --- Server Definition ---

async function main() {
  const server = new Server(
    {
      name: "iztro-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "Get_Chart_Basics",
          description: "Initialize or retrieve basic chart info (Gender, Dates, 5-Elements, Soul/Body Palace). If arguments provided, generates new chart.",
          inputSchema: {
            type: "object",
            properties: {
              birthday: { type: "string", description: "Solar Date YYYY-MM-DD" },
              birthTime: { type: "number", description: "Time Index 0-12" },
              gender: { type: "string", enum: ["male", "female"] },
              language: {
                type: "string",
                enum: ["zh-CN", "zh-TW", "en-US", "ja-JP", "ko-KR", "vi-VN"],
                description: "Output language for palace/star names.",
              }
            },
          },
        },
        {
          name: "Get_Palace_Info",
          description: "Get info for one or all palaces",
          inputSchema: {
              type: "object",
              properties: {
                  palaceName: { type: "string", description: "Palace name (must match the chart language) or 'All'. Tip: call Get_Palace_Info with 'All' to discover available names." }
              },
              required: ["palaceName"]
          }
        },
        {
          name: "Get_Stars_In_Palace",
          description: "Get stars in a specific palace",
          inputSchema: {
              type: "object",
              properties: {
                  palaceName: { type: "string" }
              },
              required: ["palaceName"]
          }
        },
        {
          name: "Get_Star_Attributes",
          description: "Get attributes of a specific star",
          inputSchema: {
              type: "object",
              properties: {
                  starName: { type: "string" }
              },
              required: ["starName"]
          }
        },
        {
          name: "Get_Natal_SiHua",
          description: "Get Birth SiHua (Mutagens)",
          inputSchema: { type: "object", properties: {} }
        },
        {
          name: "Get_SanFang_SiZheng",
          description: "Get Three Parties and Four Areas (San Fang Si Zheng)",
          inputSchema: {
              type: "object",
              properties: {
                  palaceName: { type: "string" }
              },
              required: ["palaceName"]
          }
        },
        {
          name: "Get_AnHe_Palace",
          description: "Get Dark Join (An He) Palace",
          inputSchema: {
              type: "object",
              properties: {
                  palaceName: { type: "string" }
              },
              required: ["palaceName"]
          }
        },
        {
          name: "Get_ChongZhao_Palace",
          description: "Get Opposite (Chong/Zhao) Palace",
          inputSchema: {
              type: "object",
              properties: {
                  palaceName: { type: "string" }
              },
              required: ["palaceName"]
          }
        },
        {
          name: "Get_Jia_Gong_Info",
          description: "Get Neighboring Palaces Info for Flanking/Clamping analysis",
          inputSchema: {
              type: "object",
              properties: {
                  palaceName: { type: "string" }
              },
              required: ["palaceName"]
          }
        }
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request: unknown) => {
    try {
      const req = request as { params?: { name?: string; arguments?: unknown } };
      const name = req.params?.name;
      const args = req.params?.arguments;

      switch (name) {
        case "Get_Chart_Basics": return await getChartBasics(args);
        case "Get_Palace_Info": return await getPalaceInfo(args);
        case "Get_Stars_In_Palace": return await getStarsInPalace(args);
        case "Get_Star_Attributes": return await getStarAttributes(args);
        case "Get_Natal_SiHua": return await getNatalSiHua();
        case "Get_SanFang_SiZheng": return await getSanFangSiZheng(args);
        case "Get_AnHe_Palace": return await getAnHePalace(args);
        case "Get_ChongZhao_Palace": return await getChongZhaoPalace(args);
        case "Get_Jia_Gong_Info": return await getJiaGongInfo(args);
        default:
          throw new Error("Unknown tool");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
