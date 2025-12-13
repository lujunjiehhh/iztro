import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as iztro from "../src/index";
import { IFunctionalAstrolabe } from "../src/astro/FunctionalAstrolabe";
import { IFunctionalPalace } from "../src/astro/FunctionalPalace";
import { PalaceName } from "../src/i18n";

// --- State Management ---
let currentAstrolabe: IFunctionalAstrolabe | null = null;

// --- Helper Functions ---

/**
 * Ensures a chart is currently set. Throws error if not.
 */
function requireChart(): IFunctionalAstrolabe {
  if (!currentAstrolabe) {
    throw new Error(
      "No chart is currently active. Please use 'Get_Chart_Basics' or 'Set_Chart' first."
    );
  }
  return currentAstrolabe;
}

// --- Tool Implementations ---

// MCP-F01: Get_Chart_Basics
const getChartBasics = async (args: any) => {
  // If arguments are provided, generate a new chart.
  if (args.birthday && args.birthTime && args.gender) {
    const { birthday, birthTime, gender } = args;
    // Basic parsing, assuming birthday is YYYY-MM-DD and birthTime is index 0-12

    // Accessing via iztro.astro.bySolar
    currentAstrolabe = iztro.astro.bySolar(birthday, Number(birthTime), gender === "male" ? "男" : "女", true, "zh-CN");
  } else if (!currentAstrolabe) {
      throw new Error("Please provide birthday, birthTime (0-12), and gender (male/female) to initialize the chart.");
  }

  const chart = currentAstrolabe;
  // chart.body is the NAME of the body palace (string/StarName/PalaceName) in IFunctionalAstrolabe definition
  // wait, let's check definition.
  // FunctionalAstrolabe.ts: body: t(earthlyBranches[earthlyBranchOfYear].body) -> This seems to be a string name.
  // The method `palace(indexOrName)` takes number | PalaceName.
  // We need to be careful about types.

  const bodyPalace = chart.palace(chart.body as PalaceName);
  const soulPalace = chart.palace(chart.soul as PalaceName);

  // fiveElementsClass is like "木三局"
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
          soulPalaceBranch: soulPalace?.earthlyBranch, // 命宫地支
          bodyPalaceBranch: bodyPalace?.earthlyBranch, // 身宫地支
          bodyPalaceLocation: chart.body, // 身宫所在的宫位名称
        }, null, 2),
      },
    ],
  };
};

// MCP-F02: Get_Palace_Info
const getPalaceInfo = async (args: any) => {
  const chart = requireChart();
  const { palaceName } = args;

  const palacesToReturn: IFunctionalPalace[] = [];

  if (palaceName === "All") {
    palacesToReturn.push(...chart.palaces);
  } else {
    const p = chart.palace(palaceName as PalaceName);
    if (p) palacesToReturn.push(p);
    else throw new Error(`Palace '${palaceName}' not found.`);
  }

  const result = palacesToReturn.map(p => ({
    name: p.name,
    earthlyBranch: p.earthlyBranch,
    heavenlyStem: p.heavenlyStem,
  }));

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
};

// MCP-F03: Get_Stars_In_Palace
const getStarsInPalace = async (args: any) => {
  const chart = requireChart();
  const { palaceName } = args;
  const p = chart.palace(palaceName as PalaceName);

  if (!p) throw new Error(`Palace '${palaceName}' not found.`);

  const stars = [
    ...p.majorStars,
    ...p.minorStars,
    ...p.adjectiveStars
  ].map(s => ({
    name: s.name,
    type: s.type,
    mutagen: s.mutagen
  }));

  return {
    content: [{ type: "text", text: JSON.stringify(stars, null, 2) }],
  };
};

// MCP-F04: Get_Star_Attributes
const getStarAttributes = async (args: any) => {
  const chart = requireChart();
  const { starName } = args;
  // starName must be StarName type, but string is usually fine at runtime if it matches.
  // We cast to any to avoid strict enum checks if needed, or assume library handles strings.
  // star() takes StarName.
  const star = chart.star(starName as any);

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
const getNatalSiHua = async (args: any) => {
    const chart = requireChart();

    const siHuaMap: Record<string, any> = {};

    chart.palaces.forEach(p => {
        [...p.majorStars, ...p.minorStars].forEach(s => {
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
const getSanFangSiZheng = async (args: any) => {
    const chart = requireChart();
    const { palaceName } = args;

    const surrounded = chart.surroundedPalaces(palaceName as PalaceName);

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
const getAnHePalace = async (args: any) => {
    const chart = requireChart();
    const { palaceName } = args;
    const p = chart.palace(palaceName as PalaceName);
    if (!p) throw new Error("Palace not found");

    const branch = p.earthlyBranch;
    const pairs: Record<string, string> = {
        "子": "丑", "丑": "子",
        "寅": "亥", "亥": "寅",
        "卯": "戌", "戌": "卯",
        "辰": "酉", "酉": "辰",
        "巳": "申", "申": "巳",
        "午": "未", "未": "午"
    };

    const targetBranch = pairs[branch];
    const targetPalace = chart.palaces.find(tp => tp.earthlyBranch === targetBranch);

    return {
        content: [{ type: "text", text: JSON.stringify({
            source: p.name,
            sourceBranch: branch,
            anHePalace: targetPalace?.name,
            anHeBranch: targetBranch
        }, null, 2) }]
    };
};

// MCP-R03: Get_ChongZhao_Palace
const getChongZhaoPalace = async (args: any) => {
    const chart = requireChart();
    const { palaceName } = args;
    const surrounded = chart.surroundedPalaces(palaceName as PalaceName);

    return {
        content: [{ type: "text", text: JSON.stringify({
            source: palaceName,
            opposite: surrounded.opposite.name
        }, null, 2) }]
    };
};

// MCP-R04: Get_Jia_Gong_Info
const getJiaGongInfo = async (args: any) => {
    const chart = requireChart();
    const { palaceName } = args;
    const p = chart.palace(palaceName as PalaceName);
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
                stars: prevPalace?.majorStars.map(s => s.name)
            },
            nextPalace: {
                name: nextPalace?.name,
                stars: nextPalace?.majorStars.map(s => s.name)
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
              gender: { type: "string", enum: ["male", "female"] }
            },
          },
        },
        {
          name: "Get_Palace_Info",
          description: "Get info for one or all palaces",
          inputSchema: {
              type: "object",
              properties: {
                  palaceName: { type: "string", description: "Name of palace (e.g. 命宫) or 'All'" }
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

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      switch (request.params.name) {
        case "Get_Chart_Basics": return await getChartBasics(request.params.arguments);
        case "Get_Palace_Info": return await getPalaceInfo(request.params.arguments);
        case "Get_Stars_In_Palace": return await getStarsInPalace(request.params.arguments);
        case "Get_Star_Attributes": return await getStarAttributes(request.params.arguments);
        case "Get_Natal_SiHua": return await getNatalSiHua(request.params.arguments);
        case "Get_SanFang_SiZheng": return await getSanFangSiZheng(request.params.arguments);
        case "Get_AnHe_Palace": return await getAnHePalace(request.params.arguments);
        case "Get_ChongZhao_Palace": return await getChongZhaoPalace(request.params.arguments);
        case "Get_Jia_Gong_Info": return await getJiaGongInfo(request.params.arguments);
        default:
          throw new Error("Unknown tool");
      }
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
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
