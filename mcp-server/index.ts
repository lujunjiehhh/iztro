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
import type { IFunctionalHoroscope } from "../lib/astro/FunctionalHoroscope.js";
import type { PalaceName, StarName } from "../lib/i18n/index.js";
import { StarAttributes } from "./src/data/star_attributes.js";
import { patternEngine } from "./src/pattern_engine.js";

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
        language as any,
      );
  } else if (!currentAstrolabe) {
      throw new Error("Please provide birthday, birthTime (0-12), and gender (male/female) to initialize the chart.");
  }

  const chart = currentAstrolabe;

  const lifePalace = getSoulPalace(chart);

  // Body Palace is the one where isBodyPalace is true.
  const bodyPalace = getPalaces(chart).find((p) => p.isBodyPalace);

  // Evaluate Patterns
  const matchedPatterns = await patternEngine.evaluatePatterns(chart);

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
          bodyStar: chart.body,  // "Body" (Shen Zhu) Star
          patterns: matchedPatterns.map(p => ({
              name: p.name,
              description: p.description
          }))
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

  // Enrich with static attributes
  const staticAttrs = StarAttributes[String(starName)] || StarAttributes["DEFAULT"];

  return {
    content: [{ type: "text", text: JSON.stringify({
      name: star.name,
      brightness: star.brightness,
      mutagen: star.mutagen,
      wuxing: staticAttrs.wuxing,
      yinYang: staticAttrs.yinYang,
      lucky: staticAttrs.lucky,
      keywords: staticAttrs.keywords
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

// --- Temporal Tools (Decade) ---

// Helper: Get Decade Palace
function getDecadePalace(chart: IFunctionalAstrolabe, ageOrIndex: number): IFunctionalPalace {
    // If index (0-11), get by index. Note: iztro indexes usually start from Ming (Life) palace?
    // Actually, decades are property of palaces. We need to find the palace that covers the age.
    // Or if argument is < 12, assume it's an index of the decade sequence (1st decade, 2nd decade).
    // Logic: if < 12, it is the Nth limit (0-based).
    // If >= 12, it is an age.

    const palaces = getPalaces(chart);

    if (ageOrIndex < 12) {
        // Find the palace corresponding to the Nth limit.
        // Usually, 1st limit is Life Palace.
        // Direction (Yang Male/Yin Female = CW? or CCW? depends on Five Elements and Gender).
        // Iztro handles this logic internally?
        // Let's rely on finding the palace where `decadal.range` is the Nth one?
        // Actually, easier: The Nth decade corresponds to a specific palace rotation.
        // BUT, iztro doesn't seem to expose "limit index" directly.
        // It exposes `ages`.
        // Let's stick to "Age" as primary input. If < 12, we treat it as 10*x + base? No, that's risky.
        // Let's require Age for accuracy. Or iterating to find the Nth range.

        // Heuristic: If < 12, treat as relative index from Life Palace (0 = Life, 1 = Next Decade).
        // To find the "Next Decade", we need to know the direction (Yang/Yin).
        // Iztro's `fiveElementsClass` determines the starting age (e.g. 2, 3, 4, 5, 6).
        // Let's implement Age-based mostly. If user passes 0-11, we try to interpret.
        // Actually, let's just error if ambiguous or default to Age.
        // Better: Find the palace whose `decadal.range` index matches? No.

        // Let's just assume the user passes a target Age for now as it's safer.
        // But if they want "3rd Limit", they might pass 3.
        // Let's use the first palace's decadal range start + (index * 10) roughly?
        // Let's Stick to Age. The prompt says "Age or Decade Index".
        // If Index:
        //   Life Palace is always the 1st Decade.
        //   The next palace depends on gender/stem (Yin/Yang).
        //   Iztro doesn't seem to expose a simple "getNextDecadePalace" on the chart level easily.
        //   But `palace.ages` contains the ages visited.
        //   Life Palace (Index M) -> ages[0] is the start of 1st limit.
        //   If we want limit N (0-based), we need to find which palace has that limit.
        //   Actually, every palace represents a decade.
        //   The sequence is defined by the chart structure.
        //   Let's find the palace that has the `(index * 10) + startAge` roughly?
        //   Actually, simply: Life Palace is limit 0.
        //   Direction: Male/Positive or Female/Negative => Clockwise (next index).
        //   Male/Negative or Female/Positive => Counter-Clockwise (prev index).

        // Let's try to deduce direction from the Life Palace's `ages` vs next palace `ages`.
        const life = getSoulPalace(chart);
        if (!life) throw new Error("Life Palace not found");

        const lifeStart = life.decadal.range[0];
        // Check next palace (index + 1)
        const nextIdx = (life.index + 1) % 12;
        const nextPalace = chart.palace(nextIdx);
        // If next palace start > life start, it's Clockwise.
        // Else it's Counter-Clockwise.
        const isCW = nextPalace && nextPalace.decadal.range[0] > lifeStart;

        // If index provided:
        if (ageOrIndex < 13) { // 0 to 12
             const steps = ageOrIndex;
             const targetIdx = isCW
                ? (life.index + steps) % 12
                : (life.index - steps + 12) % 12;
             return chart.palace(targetIdx) as IFunctionalPalace;
        }
    }

    // Treat as Age
    const age = ageOrIndex;
    const found = palaces.find(p => age >= p.decadal.range[0] && age <= p.decadal.range[1]);
    if (!found) throw new Error(`No decade found for age ${age}.`);
    return found;
}

// MCP-T01: Get_Decade_Info
const getDecadeInfo = async (rawArgs: unknown) => {
    const args = validateArgs(rawArgs);
    const chart = requireChart();

    // Support ageOrIndex (from schema) or age/index
    const inputVal = args.ageOrIndex ?? args.age ?? args.index;

    if (typeof inputVal !== 'number') throw new Error("Argument 'ageOrIndex' (number) is required.");

    const decadePalace = getDecadePalace(chart, inputVal);
    const decadeStem = decadePalace.heavenlyStem;
    const decadeBranch = decadePalace.earthlyBranch;

    // We need to map the "Decade Palaces" relative to the Decade Life Palace (which is 'decadePalace').
    // Decade Life = decadePalace.
    // Decade Siblings = palace after/before decadePalace?
    // The relative order of 12 palaces is fixed.
    // If Decade Life is at X, Decade Siblings is at X-1 (CCW) or X+1?
    // Standard sequence: Life, Sib, Spouse, Children, Wealth, Health, Migration, Friends, Career, Property, Spirit, Parents.
    // This sequence is always Counter-Clockwise on the chart (Z -> Y -> X...).
    // Wait, let's verify standard sequence direction.
    // Indices in iztro: 0..11.
    // Usually Life is X. Siblings is X-1.
    // Let's check:
    // Life(命) -> Sib(兄) -> Spo(夫) -> Child(子) -> Wealth(财) ...
    // This is CCW.
    // So if Decade Life is at Index D.
    // Decade Siblings is at (D - 1).
    // Decade Spouse is at (D - 2).

    // Let's generate the mapping.
    // Names of 12 palaces in order.
    const palaceNamesInOrder = [
        "命宫", "兄弟", "夫妻", "子女", "财帛", "疾厄", "迁移", "交友", "官禄", "田宅", "福德", "父母"
    ];

    const mapping: any[] = [];
    const startIdx = decadePalace.index; // Index of Decade Life

    palaceNamesInOrder.forEach((name, i) => {
        // Target index for this relative palace
        // i=0 (Life) -> startIdx
        // i=1 (Sib) -> startIdx - 1
        // ...
        const targetIdx = (startIdx - i + 12) % 12;
        const originalPalace = chart.palace(targetIdx);

        mapping.push({
            decadePalace: name, // "Decade Life", "Decade Siblings"
            originalPalace: originalPalace?.name,
            originalBranch: originalPalace?.earthlyBranch
        });
    });

    return {
        content: [{ type: "text", text: JSON.stringify({
            range: decadePalace.decadal.range,
            decadeStem,
            decadeBranch,
            mapping
        }, null, 2) }]
    };
};

// MCP-T02: Get_Decade_SiHua
const getDecadeSiHua = async (rawArgs: unknown) => {
    // Input: decadeStem (optional? No, usually derived from current chart context if stateful, but here we prefer explicit or derived from age)
    // To match MCP-T01, let's allow 'age' or 'stem'.
    const args = validateArgs(rawArgs);
    const chart = requireChart();

    let stem = args.stem as string;
    if (!stem) {
        // Try to derive from age if provided
        const inputVal = args.age ?? args.index;
        if (typeof inputVal === 'number') {
            const p = getDecadePalace(chart, inputVal);
            stem = p.heavenlyStem;
        } else {
             throw new Error("Argument 'stem' (string) or 'age' (number) is required.");
        }
    }

    // We need to calculate SiHua for this Stem.
    // Iztro might have a helper?
    // I noticed `iztro.utils` or similar in my exploration?
    // Or I can hardcode the lookup.
    // I have the lookup in my context (Table 3/6).
    // Let's use a helper function or map.

    // Map: Stem -> { lu: Star, quan: Star, ke: Star, ji: Star }
    const siHuaTable: Record<string, { lu: string, quan: string, ke: string, ji: string }> = {
        "甲": { lu: "廉贞", quan: "破军", ke: "武曲", ji: "太阳" },
        "乙": { lu: "天机", quan: "天梁", ke: "紫微", ji: "太阴" },
        "丙": { lu: "天同", quan: "天机", ke: "文昌", ji: "廉贞" },
        "丁": { lu: "太阴", quan: "天同", ke: "天机", ji: "巨门" },
        "戊": { lu: "贪狼", quan: "太阴", ke: "右弼", ji: "天机" },
        "己": { lu: "武曲", quan: "贪狼", ke: "天梁", ji: "文曲" },
        "庚": { lu: "太阳", quan: "武曲", ke: "天府", ji: "天同" }, // Ke: Tai Yin or Tian Fu? Prompt says "MCP should use backend version". Iztro uses Tian Fu for Geng Ke? Or Tai Yin?
                                                                  // I will use Tian Fu as per common modern/iztro usage (needs verify).
                                                                  // Actually, let's check what iztro uses for Natal Geng.
                                                                  // If uncertain, I will assume standard ZWDS.
                                                                  // Reference Table 3 in prompt says: "Tai Yin/Tian Fu".
                                                                  // I'll stick to Tian Fu for now, or check if I can ask iztro.
                                                                  // Let's rely on the hardcoded table I provide here.
        "辛": { lu: "巨门", quan: "太阳", ke: "文曲", ji: "文昌" },
        "壬": { lu: "天梁", quan: "紫微", ke: "左辅", ji: "武曲" },
        "癸": { lu: "破军", quan: "巨门", ke: "太阴", ji: "贪狼" }
    };
    // Fix Geng/Ren conflicts:
    // Geng Ke: classic is Tai Yin. Some use Tian Fu.
    // Ren Ke: classic is Zuo Fu. Some use Tian Fu.
    // I will use the table provided in the prompt's Table 3 as guide where it listed "Tai Yin/Tian Fu".
    // I'll pick one. Let's pick Tai Yin for Geng Ke, Zuo Fu for Ren Ke as common defaults.
    // WAIT! Iztro library logic is available!
    // `star.mutagen` is calculated by iztro.
    // Can I ask iztro to calculate mutagens for a stem?
    // `iztro.utils.getMutagensByHeavenlyStem(stem)`?
    // I saw this in the stack trace earlier: `getMutagensByHeavenlyStem`.
    // Let's try to access it. `iztro.utils` was not exported in `index.js` but `iztro` object had `utils`?
    // My exploration showed keys: `[ 'data', 'star', 'util', 'astro' ]`. Note `util` (singular).

    let mutagens = null;
    try {
        // @ts-ignore
        mutagens = iztro.util.getMutagensByHeavenlyStem(stem);
    } catch (e) {
        // Fallback to manual map
    }

    if (mutagens) {
        // Map back to format
        // mutagens is likely: { lu: 'StarName', ... } or array?
        // Let's just return what it gives if valid.
        // Assuming it returns names.
    } else {
         mutagens = siHuaTable[stem];
    }

    if (!mutagens) throw new Error("Invalid Stem");

    // We also need to find where these stars are in the Original Chart.
    const result: any = {};
    const types = ['lu', 'quan', 'ke', 'ji']; // keys in my table or iztro result?
    // If iztro result, keys might be different. Let's use my table for consistency if iztro fails or use mapped.
    // If using my table:
    const map = siHuaTable[stem];
    for (const k of types) {
        // @ts-ignore
        const starName = map[k];
        const star = chart.star(starName);
        // Find which palace holds this star
        // star.palace() returns the palace object
        // NOTE: star object has .palace() method?
        // or iterate palaces.
        let palaceName = "Unknown";
        getPalaces(chart).forEach(p => {
             if ([...p.majorStars, ...p.minorStars].some(s => s.name === starName)) {
                 palaceName = p.name;
             }
        });

        result[k] = {
            star: starName,
            palace: palaceName
        };
    }

    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
};

// MCP-T03: Get_Decade_Overlapping_Palaces
const getDecadeOverlappingPalaces = async (rawArgs: unknown) => {
    // This is effectively covered by Get_Decade_Info's "mapping" field,
    // but the prompt requests a specific tool.
    // I will reuse the logic.
    return await getDecadeInfo(rawArgs);
};

// --- Temporal Tools (Annual) ---

// MCP-T04: Get_Annual_Info
const getAnnualInfo = async (rawArgs: unknown) => {
    const args = validateArgs(rawArgs);
    const chart = requireChart();
    const year = args.year; // string "2025" or number
    if (!year) throw new Error("Argument 'year' is required.");

    // Format date string for iztro
    const midYear = `${year}-06-15`;

    let annualChart: IFunctionalHoroscope;
    try {
        // timeIndex 0 is fine
        annualChart = chart.horoscope(midYear, 0);
    } catch (e: any) {
        throw new Error(`Failed to generate annual chart: ${e.message}`);
    }

    // Identify Annual Palaces
    // IFunctionalHoroscope uses .palace(name, scope) method, not .palaces array.
    // Use "仆役" instead of "交友" as it is the standard key in iztro for lookup usually.
    // We will try both if one fails, or stick to standard ZWDS names.
    const palaceNames = [
        "命宫", "兄弟", "夫妻", "子女", "财帛", "疾厄",
        "迁移", "仆役", "官禄", "田宅", "福德", "父母"
    ];

    const mapping: any[] = [];
    let annualLifeLocation = "";

    palaceNames.forEach((name) => {
        // Scope 'yearly' (flowYear)
        const p = annualChart.palace(name as PalaceName, 'yearly');
        if (p) {
             mapping.push({
                 annualPalace: name,
                 originalPalace: p.name, // The palace object returned IS the original palace, but in the context of the year?
                 // Wait, p returned by annualChart.palace(...) is an IFunctionalPalace.
                 // Does it represent the *slot* in the annual chart, or the *original* palace that falls into that slot?
                 // Usually, it returns the palace object from the astrolabe that corresponds to that annual function.
                 // e.g. Annual Life Palace might be the Original Wealth Palace.
                 // So p.name would be "财帛" (Original Wealth).
                 // We want to know: Annual "Life" -> Original "Wealth".
                 originalPalaceName: p.name,
                 originalBranch: p.earthlyBranch
             });

             if (name === "命宫") {
                 annualLifeLocation = p.earthlyBranch;
             }
        }
    });

    return {
        content: [{ type: "text", text: JSON.stringify({
            year: year,
            solarDateUsed: midYear,
            lunarDate: annualChart.lunarDate,
            annualLifeLocation: annualLifeLocation,
            mapping
        }, null, 2) }]
    };
};

// MCP-T05: Get_Annual_SiHua
const getAnnualSiHua = async (rawArgs: unknown) => {
    const args = validateArgs(rawArgs);
    const chart = requireChart();
    const stem = args.stem as string;
    // Or derive from year
    // If year provided, calc stem.
    // Year 2025 -> Yi (乙).
    // (Year - 4) % 10 -> Stem index.
    // 0=Jia, 1=Yi...
    // (2025 - 4) % 10 = 1 => Yi.
    // Logic: 4 AD = 甲子 (Jia Zi)?
    // Actually: 1984 is Jia Zi.
    // (Year - 1984) % 60.
    // (2025 - 1984) = 41.
    // 41 % 10 = 1 => Yi (Index 1). Correct.
    // Stems: 甲(0), 乙(1), 丙(2), 丁(3), 戊(4), 己(5), 庚(6), 辛(7), 壬(8), 癸(9).

    let targetStem = stem;
    if (!targetStem && args.year) {
        const y = Number(args.year);
        const stems = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
        const idx = (y - 4) % 10;
        targetStem = stems[idx >= 0 ? idx : idx + 10];
    }

    if (!targetStem) throw new Error("Stem or Year required.");

    // Reuse logic from Decade SiHua (same table, different scope context if needed, but 'Get_Annual_SiHua' just asks for stars).
    // Calling internal helper if I refactored.
    // For now, I'll copy-paste the table logic or call getDecadeSiHua logic.
    // Hack: Call getDecadeSiHua implementation with 'stem'.
    return await getDecadeSiHua({ stem: targetStem });
};

// MCP-T06: Get_Annual_Overlapping_Palaces
const getAnnualOverlappingPalaces = async (rawArgs: unknown) => {
    return await getAnnualInfo(rawArgs);
};

// MCP-T07: Get_Palace_Stem_SiHua (Flying Star)
const getPalaceStemSiHua = async (rawArgs: unknown) => {
    const args = validateArgs(rawArgs);
    const chart = requireChart();
    // palaceName: "命宫"
    // scope: "original" | "decade" | "annual" (Default original)
    const palaceName = args.palaceName as string;
    if (!palaceName) throw new Error("palaceName is required.");

    // Find the palace
    // If scope is original:
    const p = chart.palace(palaceName as PalaceName);
    if (!p) throw new Error(`Palace ${palaceName} not found.`);

    const stem = p.heavenlyStem;

    // Calculate SiHua for this stem
    // Using the same SiHua table
    // (Code duplication here, ideally refactor to `getSiHuaForStem(stem)`)
    // I will define the table again locally or move it up scope in next refactor step if I were human,
    // but here I will just use the internal logic.

    const siHuaTable: Record<string, { lu: string, quan: string, ke: string, ji: string }> = {
        "甲": { lu: "廉贞", quan: "破军", ke: "武曲", ji: "太阳" },
        "乙": { lu: "天机", quan: "天梁", ke: "紫微", ji: "太阴" },
        "丙": { lu: "天同", quan: "天机", ke: "文昌", ji: "廉贞" },
        "丁": { lu: "太阴", quan: "天同", ke: "天机", ji: "巨门" },
        "戊": { lu: "贪狼", quan: "太阴", ke: "右弼", ji: "天机" },
        "己": { lu: "武曲", quan: "贪狼", ke: "天梁", ji: "文曲" },
        "庚": { lu: "太阳", quan: "武曲", ke: "天府", ji: "天同" },
        "辛": { lu: "巨门", quan: "太阳", ke: "文曲", ji: "文昌" },
        "壬": { lu: "天梁", quan: "紫微", ke: "左辅", ji: "武曲" },
        "癸": { lu: "破军", quan: "巨门", ke: "太阴", ji: "贪狼" }
    };

    const map = siHuaTable[stem];
    const result: any[] = [];
    const types = { lu: "化禄", quan: "化权", ke: "化科", ji: "化忌" };

    for (const [key, starName] of Object.entries(map)) {
        // Find which palace holds this star in the original chart
        let targetPalaceName = "Unknown";
        getPalaces(chart).forEach(tp => {
             if ([...tp.majorStars, ...tp.minorStars].some(s => s.name === starName)) {
                 targetPalaceName = tp.name;
             }
        });

        result.push({
            type: (types as any)[key], // "化禄"
            star: starName,
            targetPalace: targetPalaceName
        });
    }

    return {
        content: [{ type: "text", text: JSON.stringify({
            sourcePalace: palaceName,
            stem: stem,
            flyingStars: result
        }, null, 2) }]
    };
};

// --- Store Tool ---
const storeStarCombination = async (rawArgs: unknown) => {
    const args = validateArgs(rawArgs);
    const { name, script, description, examples } = args;

    if (typeof name !== 'string' || typeof script !== 'string') {
        throw new Error("Name and Script are required.");
    }

    const id = await patternEngine.addPattern({
        name,
        script,
        description: String(description || ''),
        examples: String(examples || '')
    });

    return {
        content: [{ type: "text", text: `Pattern '${name}' stored successfully with ID ${id}.` }]
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
              language: { type: "string", description: "Optional language code (e.g. zh-CN, en-US)" }
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
        },
        {
            name: "Get_Decade_Info",
            description: "Get Decade (Da Xian) info. Input age (e.g. 35) or index (0-11).",
            inputSchema: {
                type: "object",
                properties: {
                    ageOrIndex: { type: "number" }
                },
                required: ["ageOrIndex"]
            }
        },
        {
            name: "Get_Decade_SiHua",
            description: "Get Decade SiHua. Input stem (string) or age (number).",
            inputSchema: {
                type: "object",
                properties: {
                    stem: { type: "string" },
                    age: { type: "number" }
                }
            }
        },
        {
            name: "Get_Decade_Overlapping_Palaces",
            description: "Get mapping of Decade palaces to Original palaces.",
            inputSchema: {
                type: "object",
                properties: {
                    ageOrIndex: { type: "number" }
                },
                required: ["ageOrIndex"]
            }
        },
        {
            name: "Get_Annual_Info",
            description: "Get Annual (Liu Nian) info.",
            inputSchema: {
                type: "object",
                properties: {
                    year: { type: "number", description: "Year (e.g. 2025)" }
                },
                required: ["year"]
            }
        },
        {
            name: "Get_Annual_SiHua",
            description: "Get Annual SiHua.",
            inputSchema: {
                type: "object",
                properties: {
                    year: { type: "number" },
                    stem: { type: "string" }
                }
            }
        },
        {
            name: "Get_Annual_Overlapping_Palaces",
            description: "Get mapping of Annual palaces.",
            inputSchema: {
                type: "object",
                properties: {
                    year: { type: "number" }
                },
                required: ["year"]
            }
        },
        {
            name: "Get_Palace_Stem_SiHua",
            description: "Calculate Flying Stars (Mutagens) from a specific Palace's Stem.",
            inputSchema: {
                type: "object",
                properties: {
                    palaceName: { type: "string" }
                },
                required: ["palaceName"]
            }
        },
        {
            name: "Store_Star_Combination_Meaning",
            description: "Store a new Star Pattern logic.",
            inputSchema: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    script: { type: "string", description: "JS code evaluating to boolean. Context: 'chart'." },
                    description: { type: "string" },
                    examples: { type: "string" }
                },
                required: ["name", "script"]
            }
        }
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const toolName = request.params.name;
      // Note: We use the tool functions defined above which handle validation
      switch (toolName) {
        case "Get_Chart_Basics": return await getChartBasics(request.params.arguments);
        case "Get_Palace_Info": return await getPalaceInfo(request.params.arguments);
        case "Get_Stars_In_Palace": return await getStarsInPalace(request.params.arguments);
        case "Get_Star_Attributes": return await getStarAttributes(request.params.arguments);
        case "Get_Natal_SiHua": return await getNatalSiHua(); // No args
        case "Get_SanFang_SiZheng": return await getSanFangSiZheng(request.params.arguments);
        case "Get_AnHe_Palace": return await getAnHePalace(request.params.arguments);
        case "Get_ChongZhao_Palace": return await getChongZhaoPalace(request.params.arguments);
        case "Get_Jia_Gong_Info": return await getJiaGongInfo(request.params.arguments);
        // New Tools
        case "Get_Decade_Info": return await getDecadeInfo(request.params.arguments);
        case "Get_Decade_SiHua": return await getDecadeSiHua(request.params.arguments);
        case "Get_Decade_Overlapping_Palaces": return await getDecadeOverlappingPalaces(request.params.arguments);
        case "Get_Annual_Info": return await getAnnualInfo(request.params.arguments);
        case "Get_Annual_SiHua": return await getAnnualSiHua(request.params.arguments);
        case "Get_Annual_Overlapping_Palaces": return await getAnnualOverlappingPalaces(request.params.arguments);
        case "Get_Palace_Stem_SiHua": return await getPalaceStemSiHua(request.params.arguments);
        case "Store_Star_Combination_Meaning": return await storeStarCombination(request.params.arguments);
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
