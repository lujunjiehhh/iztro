/**
 * @file mcp-server-stdio.ts
 * @description Implements a basic stdio server loop for handling MCP tool requests.
 */

import * as readline from 'readline';
import {
  // Enums
  PalaceName, DiZhi, TianGan, StarType, BrightnessLevel, WuXing, YinYang, BasicLuck, SiHuaType, Gender, WuXingJu, ChartLevel,
  // MCP-F Series
  BirthInfo, PalaceInfo, StarInPalace, StarAttributes, NatalSiHuaStar,
  // MCP-R Series Helper
  PalaceDescriptor, PalaceIdentifierInput, FlankingStarInfo,
  // MCP-R Series Outputs
  SanFangSiZhengInfo, AnHePalaceInfo, ChongZhaoPalaceInfo, JiaGongInfo,
  // MCP-T Series Helper
  TimeBoundPalaceMapping, TemporalSiHuaStar, OverlappingPalaceInfo, AnnualToNatalOverlap, AnnualToDecadeOverlap, FeiSiHuaStarInfo,
  // MCP-T Series Outputs
  DecadeInfo, AnnualInfo, AnnualOverlappingPalacesInfo,
  // MCP-A Series Helper
  FullNatalChartContext, StarCombinationInput,
  // MCP-A Series Outputs
  AstrologicalPatternInfo, StarCombinationMeaning,
} from './mcp-tools';

/**
 * @interface McpRequest
 * @description Defines the basic structure of an incoming MCP request.
 */
interface McpRequest {
  requestId: string;
  toolId: string;
  params: any; // Parameters for the tool
}

/**
 * @interface McpErrorResponse
 * @description Defines the structure of an error response.
 */
interface McpErrorResponse {
  requestId: string | null;
  status: "error";
  error: {
    message: string;
    code: string;
  };
}

/**
 * @interface McpSuccessResponse
 * @description Defines the structure of a generic success response.
 */
interface McpSuccessResponse {
  requestId: string;
  status: "success";
  data: any;
}

/**
 * Writes a response object to stdout as a JSON string.
 * @param {McpErrorResponse | McpSuccessResponse} response - The response object to write.
 */
function writeResponse(response: McpErrorResponse | McpSuccessResponse): void {
  process.stdout.write(JSON.stringify(response) + '\n');
}

// --- Helper for Parameter Validation ---
function isValidPalaceIdentifier(identifier: any): identifier is PalaceIdentifierInput {
  return typeof identifier === 'string' && (Object.values(PalaceName).includes(identifier as PalaceName) || Object.values(DiZhi).includes(identifier as DiZhi));
}

// --- Tool Handlers (MCP-F01 to MCP-F05) - Existing ---
function handleGetChartBasics(params: any): BirthInfo {
  return { birthDate: "1990-01-01", birthTime: "12:00", gender: Gender.Male, wuXingJu: WuXingJu.FireSix, mingGongDiZhi: DiZhi.Yin, shenGongDiZhi: DiZhi.Xu, shenGongPalace: PalaceName.QianYi };
}
function handleGetPalaceInfo(params: { palaceName?: PalaceName | "All" }): PalaceInfo | PalaceInfo[] {
  if (!params || typeof params.palaceName !== 'string' || params.palaceName.trim() === "") { throw new Error("Invalid parameters: palaceName parameter is required and must be a non-empty string."); }
  if (params.palaceName !== "All" && !Object.values(PalaceName).includes(params.palaceName as PalaceName)) { throw new Error(`Invalid parameters: Invalid palaceName: '${params.palaceName}'. Must be "All" or a valid PalaceName enum member.`); }
  const mockPalace = (name: PalaceName, dz: DiZhi, tg: TianGan): PalaceInfo => ({ palaceName: name, palaceDiZhi: dz, palaceTianGan: tg, coreMeaning: `Mocked core meaning for ${name} (${tg}${dz})` });
  if (params.palaceName === "All") { return [mockPalace(PalaceName.Ming, DiZhi.Yin, TianGan.Jia), mockPalace(PalaceName.XiongDi, DiZhi.Chou, TianGan.Yi), mockPalace(PalaceName.FuQi, DiZhi.Zi, TianGan.Bing)]; }
  else { const specificPalaceName = params.palaceName as PalaceName; let pd = DiZhi.Yin; let pt = TianGan.Jia; const pna = Object.values(PalaceName); const idx = pna.indexOf(specificPalaceName); if (idx !== -1) { pd = Object.values(DiZhi)[idx % 12]; pt = Object.values(TianGan)[idx % 10]; } return mockPalace(specificPalaceName, pd, pt); }
}
function handleGetStarsInPalace(params: { palaceIdentifier?: PalaceIdentifierInput }): StarInPalace[] {
  if (!params || !isValidPalaceIdentifier(params.palaceIdentifier)) { throw new Error("Invalid parameters: palaceIdentifier parameter is required and must be a valid PalaceName or DiZhi."); }
  return [{ starName: "紫微", starType: StarType.MainStar }, { starName: "天府", starType: StarType.MainStar }, { starName: "文昌", starType: StarType.MajorAuxiliaryStar }];
}
function handleGetStarAttributes(params: { starName?: string }): StarAttributes {
  if (!params || typeof params.starName !== 'string' || params.starName.trim() === "") { throw new Error("Invalid parameters: starName parameter is required and must be a non-empty string."); }
  const starName = params.starName; const brightnessData: Partial<Record<DiZhi, BrightnessLevel>> = {}; Object.values(DiZhi).forEach(dz => { brightnessData[dz] = BrightnessLevel.Ping; }); brightnessData[DiZhi.Wu] = BrightnessLevel.Miao; brightnessData[DiZhi.Zi] = BrightnessLevel.Wang;
  return { starName: starName, brightness: brightnessData as Record<DiZhi, BrightnessLevel>, wuXing: WuXing.Earth, yinYang: YinYang.Yang, basicLuck: BasicLuck.Good, characteristics: [`Mocked characteristic A for ${starName}`, `Mocked characteristic B for ${starName}`] };
}
function handleGetNatalSiHua(params: any): NatalSiHuaStar[] {
  return [{ siHuaType: SiHuaType.Lu, originalStarName: "廉贞", palaceLocated: PalaceName.Ming }, { siHuaType: SiHuaType.Quan, originalStarName: "破军", palaceLocated: PalaceName.GuanLu }, { siHuaType: SiHuaType.Ke, originalStarName: "武曲", palaceLocated: PalaceName.CaiBo }, { siHuaType: SiHuaType.Ji, originalStarName: "太阳", palaceLocated: PalaceName.FuMu }];
}

// --- MCP-R Series Handlers ---
function handleGetSanFangSiZheng(params: { referencePalaceIdentifier?: PalaceIdentifierInput }): SanFangSiZhengInfo {
  if (!params || !isValidPalaceIdentifier(params.referencePalaceIdentifier)) { throw new Error("Invalid parameters: referencePalaceIdentifier is required and must be a valid PalaceName or DiZhi."); }
  const refPName = Object.values(PalaceName).includes(params.referencePalaceIdentifier as PalaceName) ? params.referencePalaceIdentifier as PalaceName : PalaceName.Ming;
  const refDiZhi = Object.values(DiZhi).includes(params.referencePalaceIdentifier as DiZhi) ? params.referencePalaceIdentifier as DiZhi : DiZhi.Yin;

  return {
    referencePalace: { name: refPName, diZhi: refDiZhi },
    sanFangPalaces: [ // Corrected to 3 as per mcp-tools.ts
      { name: PalaceName.GuanLu, diZhi: DiZhi.Wu },
      { name: PalaceName.CaiBo, diZhi: DiZhi.Xu },
      { name: PalaceName.FuQi, diZhi: DiZhi.Zi }, // Example 3rd palace for SF
    ],
    siZhengPalace: { name: PalaceName.QianYi, diZhi: DiZhi.Shen },
  };
}
function handleGetAnHePalace(params: { referencePalaceIdentifier?: PalaceIdentifierInput }): AnHePalaceInfo {
  if (!params || !isValidPalaceIdentifier(params.referencePalaceIdentifier)) { throw new Error("Invalid parameters: referencePalaceIdentifier is required and must be a valid PalaceName or DiZhi."); }
  const refPName = Object.values(PalaceName).includes(params.referencePalaceIdentifier as PalaceName) ? params.referencePalaceIdentifier as PalaceName : PalaceName.Ming;
  const refDiZhi = Object.values(DiZhi).includes(params.referencePalaceIdentifier as DiZhi) ? params.referencePalaceIdentifier as DiZhi : DiZhi.Yin;
  return {
    referencePalace: { name: refPName, diZhi: refDiZhi },
    anHePalace: { name: PalaceName.XiongDi, diZhi: DiZhi.Chou }, // Example AnHe
  };
}
function handleGetChongZhaoPalace(params: { referencePalaceIdentifier?: PalaceIdentifierInput }): ChongZhaoPalaceInfo {
  if (!params || !isValidPalaceIdentifier(params.referencePalaceIdentifier)) { throw new Error("Invalid parameters: referencePalaceIdentifier is required and must be a valid PalaceName or DiZhi."); }
  const refPName = Object.values(PalaceName).includes(params.referencePalaceIdentifier as PalaceName) ? params.referencePalaceIdentifier as PalaceName : PalaceName.Ming;
  const refDiZhi = Object.values(DiZhi).includes(params.referencePalaceIdentifier as DiZhi) ? params.referencePalaceIdentifier as DiZhi : DiZhi.Yin;
  return {
    referencePalace: { name: refPName, diZhi: refDiZhi },
    chongZhaoPalace: { name: PalaceName.QianYi, diZhi: DiZhi.Shen }, // Example ChongZhao (opposite)
  };
}
function handleGetJiaGongInfo(params: { referencePalaceIdentifier?: PalaceIdentifierInput }): JiaGongInfo | null {
  if (!params || !isValidPalaceIdentifier(params.referencePalaceIdentifier)) { throw new Error("Invalid parameters: referencePalaceIdentifier is required and must be a valid PalaceName or DiZhi."); }
  // Mock a case where JiaGong is found for some input, null for others
  if (params.referencePalaceIdentifier === PalaceName.Ming || params.referencePalaceIdentifier === DiZhi.Chou) {
    return {
      referencePalace: { name: PalaceName.Ming, diZhi: DiZhi.Chou }, // Example
      jiaGongType: "羊陀夹忌 (mocked)",
      flankingStars: [
        { starName: "擎羊", starPalace: { name: PalaceName.FuMu, diZhi: DiZhi.Yin } },
        { starName: "陀罗", starPalace: { name: PalaceName.XiongDi, diZhi: DiZhi.Zi } },
      ],
    };
  }
  return null; // No Jia Gong found
}

// --- MCP-T Series Handlers ---
function handleGetDecadeInfo(params: { userAge?: number; decadeIndex?: number }): DecadeInfo {
  if (!params || (typeof params.userAge !== 'number' && typeof params.decadeIndex !== 'number')) { throw new Error("Invalid parameters: Either userAge or decadeIndex (number) must be provided."); }
  const decadePalaces: TimeBoundPalaceMapping[] = Object.values(PalaceName).map((pn, index) => ({
    timePalaceName: `大限${pn}`,
    natalPalaceName: Object.values(PalaceName)[(index + 2) % 12], // Mocked shift
    timePalaceTianGan: Object.values(TianGan)[index % 10],
    timePalaceDiZhi: Object.values(DiZhi)[index % 12],
  }));
  return {
    decadeStartAge: params.userAge ? (Math.floor((params.userAge -4) / 10) * 10 +4) : (params.decadeIndex! * 10 + 4),
    decadeEndAge: params.userAge ? (Math.floor((params.userAge -4) / 10) * 10 + 13) : (params.decadeIndex! * 10 + 13),
    decadeMingGong: { name: PalaceName.Ming, diZhi: DiZhi.Mao }, // Mocked
    decadeMingGongTianGan: TianGan.Ding, // Mocked
    decadePalaces: decadePalaces,
  };
}
function handleGetDecadeSiHua(params: { decadeMingGongTianGan?: TianGan }): TemporalSiHuaStar[] {
  if (!params || !params.decadeMingGongTianGan || !Object.values(TianGan).includes(params.decadeMingGongTianGan)) { throw new Error("Invalid parameters: decadeMingGongTianGan is required and must be a valid TianGan."); }
  return [ // Example based on Ding TianGan
    { siHuaType: SiHuaType.Lu, originalStarName: "太阴", palaceLocated: { name: PalaceName.TianZhai, diZhi: DiZhi.You } },
    { siHuaType: SiHuaType.Quan, originalStarName: "天同", palaceLocated: { name: PalaceName.Ming, diZhi: DiZhi.Yin } },
    { siHuaType: SiHuaType.Ke, originalStarName: "天机", palaceLocated: { name: PalaceName.XiongDi, diZhi: DiZhi.Chou } },
    { siHuaType: SiHuaType.Ji, originalStarName: "巨门", palaceLocated: { name: PalaceName.NuPu, diZhi: DiZhi.Hai } },
  ];
}
function handleGetDecadeOverlappingPalaces(params: { decadePalaces?: TimeBoundPalaceMapping[] }): OverlappingPalaceInfo[] {
  if (!params || !Array.isArray(params.decadePalaces) || params.decadePalaces.length === 0) { throw new Error("Invalid parameters: decadePalaces array is required and must not be empty."); }
  // For mock, just return the first few items or the items themselves
  return params.decadePalaces.slice(0, 3); // Or params.decadePalaces directly
}
function handleGetAnnualInfo(params: { year?: number }): AnnualInfo {
  if (!params || typeof params.year !== 'number' || params.year < 1900 || params.year > 2300) { throw new Error("Invalid parameters: year is required and must be a valid number (e.g., 1900-2300)."); }
  const annualPalaces: TimeBoundPalaceMapping[] = Object.values(PalaceName).map((pn, index) => ({
    timePalaceName: `流年${pn}`, natalPalaceName: Object.values(PalaceName)[(index + 3) % 12],
    timePalaceTianGan: Object.values(TianGan)[(params.year! - 1984) % 10], // Example mapping
    timePalaceDiZhi: Object.values(DiZhi)[(params.year! - 1984) % 12],
  }));
  return {
    yearTianGan: Object.values(TianGan)[(params.year - 1984) % 10],
    yearDiZhi: Object.values(DiZhi)[(params.year - 1984) % 12],
    liuNianMingGong: { name: PalaceName.Ming, diZhi: DiZhi.Chen }, // Mocked
    taiSuiPalace: { name: PalaceName.Ming, diZhi: Object.values(DiZhi)[(params.year - 1984) % 12] },
    liuNianMingGongTianGan: TianGan.Wu, // Mocked
    annualPalaces: annualPalaces,
  };
}
function handleGetAnnualSiHua(params: { annualTianGan?: TianGan }): TemporalSiHuaStar[] {
  if (!params || !params.annualTianGan || !Object.values(TianGan).includes(params.annualTianGan)) { throw new Error("Invalid parameters: annualTianGan is required and must be a valid TianGan."); }
  return [ // Example based on Wu TianGan
    { siHuaType: SiHuaType.Lu, originalStarName: "贪狼", palaceLocated: { name: PalaceName.CaiBo, diZhi: DiZhi.Chen } },
    { siHuaType: SiHuaType.Quan, originalStarName: "太阴", palaceLocated: { name: PalaceName.TianZhai, diZhi: DiZhi.You } },
    { siHuaType: SiHuaType.Ke, originalStarName: "右弼", palaceLocated: { name: PalaceName.FuMu, diZhi: DiZhi.Xu } },
    { siHuaType: SiHuaType.Ji, originalStarName: "天机", palaceLocated: { name: PalaceName.XiongDi, diZhi: DiZhi.Chou } },
  ];
}
function handleGetAnnualOverlappingPalaces(params: { annualInfo?: AnnualInfo; decadeInfo?: DecadeInfo }): AnnualOverlappingPalacesInfo {
  if (!params || !params.annualInfo || !params.decadeInfo ) { throw new Error("Invalid parameters: annualInfo and decadeInfo are required."); }
  // Simplified mock, actual logic would derive from inputs
  const annualToNatal: AnnualToNatalOverlap[] = params.annualInfo.annualPalaces.map(ap => ({
    annualPalaceName: ap.timePalaceName, natalPalaceName: ap.natalPalaceName, annualPalaceTianGan: ap.timePalaceTianGan, annualPalaceDiZhi: ap.timePalaceDiZhi
  }));
  const annualToDecade: AnnualToDecadeOverlap[] = params.annualInfo.annualPalaces.map((ap, i) => ({
    annualPalaceName: ap.timePalaceName, decadePalaceName: params.decadeInfo!.decadePalaces[i % 12].timePalaceName, annualPalaceTianGan: ap.timePalaceTianGan, annualPalaceDiZhi: ap.timePalaceDiZhi
  }));
  return { annualToNatal, annualToDecade };
}
function handleGetPalaceStemSiHua(params: { chartLevel?: ChartLevel; referencePalace?: PalaceIdentifierInput }): FeiSiHuaStarInfo[] {
  if (!params || !params.chartLevel || !Object.values(ChartLevel).includes(params.chartLevel)) { throw new Error("Invalid parameters: chartLevel is required and must be a valid ChartLevel."); }
  if (!isValidPalaceIdentifier(params.referencePalace)) { throw new Error("Invalid parameters: referencePalace is required and must be a valid PalaceName or DiZhi."); }
  return [ // Example for TianGan.Jia from some palace
    { siHuaType: SiHuaType.Lu, originalStarInSourcePalace: "廉贞", targetPalace: { name: PalaceName.GuanLu, diZhi: DiZhi.Shen }, affectedStarInTargetPalace: "破军" },
    { siHuaType: SiHuaType.Quan, originalStarInSourcePalace: "破军", targetPalace: { name: PalaceName.Ming, diZhi: DiZhi.Yin } },
    { siHuaType: SiHuaType.Ke, originalStarInSourcePalace: "武曲", targetPalace: { name: PalaceName.CaiBo, diZhi: DiZhi.Chen } },
    { siHuaType: SiHuaType.Ji, originalStarInSourcePalace: "太阳", targetPalace: { name: PalaceName.JiE, diZhi: DiZhi.Wu } },
  ];
}

// --- MCP-A Series Handlers ---
function handleQueryAstrologicalPattern(params: { chartContext?: FullNatalChartContext }): AstrologicalPatternInfo[] {
  if (!params || typeof params.chartContext !== 'object' || params.chartContext === null) { throw new Error("Invalid parameters: chartContext object is required."); }
  return [{ patternName: "七杀朝斗格 (mocked)", constitutingPalacesAndStars: ["七杀 in 寅宫守命", "紫微 in 申宫 (对宫)"], conditionsMet: ["无煞冲破", "吉星会照"], generalInterpretation: "权威、开创、有领导力，但人生较辛劳" }];
}
function handleQueryStarCombinationMeaning(params: StarCombinationInput): StarCombinationMeaning { // params is StarCombinationInput directly
  if (!params || !Array.isArray(params.stars) || !(params.stars.length === 2 || params.stars.length === 3) || !params.stars.every(s => typeof s === 'string' && s.trim() !== '')) { throw new Error("Invalid parameters: stars must be an array of 2 or 3 non-empty strings."); }
  if (typeof params.contextDescription !== 'string' || params.contextDescription.trim() === '') { throw new Error("Invalid parameters: contextDescription is required and must be a non-empty string."); }
  return { interpretationText: `Mocked interpretation for ${params.stars.join(', ')} in ${params.contextDescription}`, positivePotentials: ["Good outcome A"], negativePotentials: ["Bad outcome B"], commonManifestations: ["Manifestation X"] };
}

/** Main function */
function main(): void {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  console.error(`[${new Date().toISOString()}] MCP STDIO Server started. Listening for requests on stdin...`);

  rl.on('line', (line) => {
    let parsedRequest: McpRequest | null = null;
    let requestId: string | null = null;
    try {
      parsedRequest = JSON.parse(line) as McpRequest;
      requestId = parsedRequest?.requestId || null;
      if (typeof parsedRequest !== 'object' || parsedRequest === null || !parsedRequest.toolId || !requestId) {
        throw new Error("Request is not a valid MCP request object or missing required fields (requestId, toolId).");
      }
      console.error(`[${new Date().toISOString()}] Received request: ${JSON.stringify(parsedRequest)}`);
      let responseData: any;
      let toolFound = true;
      const params = parsedRequest.params === undefined ? {} : parsedRequest.params;

      switch (parsedRequest.toolId) {
        // F-Series
        case "Get_Chart_Basics": responseData = handleGetChartBasics(params); break;
        case "Get_Palace_Info": responseData = handleGetPalaceInfo(params); break;
        case "Get_Stars_In_Palace": responseData = handleGetStarsInPalace(params); break;
        case "Get_Star_Attributes": responseData = handleGetStarAttributes(params); break;
        case "Get_Natal_SiHua": responseData = handleGetNatalSiHua(params); break;
        // R-Series
        case "Get_SanFang_SiZheng": responseData = handleGetSanFangSiZheng(params); break;
        case "Get_AnHe_Palace": responseData = handleGetAnHePalace(params); break;
        case "Get_ChongZhao_Palace": responseData = handleGetChongZhaoPalace(params); break;
        case "Get_Jia_Gong_Info": responseData = handleGetJiaGongInfo(params); break;
        // T-Series
        case "Get_Decade_Info": responseData = handleGetDecadeInfo(params); break;
        case "Get_Decade_SiHua": responseData = handleGetDecadeSiHua(params); break;
        case "Get_Decade_Overlapping_Palaces": responseData = handleGetDecadeOverlappingPalaces(params); break;
        case "Get_Annual_Info": responseData = handleGetAnnualInfo(params); break;
        case "Get_Annual_SiHua": responseData = handleGetAnnualSiHua(params); break;
        case "Get_Annual_Overlapping_Palaces": responseData = handleGetAnnualOverlappingPalaces(params); break;
        case "Get_Palace_Stem_SiHua": responseData = handleGetPalaceStemSiHua(params); break;
        // A-Series
        case "Query_Astrological_Pattern": responseData = handleQueryAstrologicalPattern(params); break;
        case "Query_Star_Combination_Meaning": responseData = handleQueryStarCombinationMeaning(params as StarCombinationInput); break; // Cast params
        default:
          toolFound = false;
          const toolNotFoundErrorResponse: McpErrorResponse = { requestId: requestId, status: "error", error: { message: `Tool ID '${parsedRequest.toolId}' not found or not yet implemented.`, code: "TOOL_NOT_FOUND" } };
          writeResponse(toolNotFoundErrorResponse);
          break;
      }
      if (toolFound) {
        const successResponse: McpSuccessResponse = { requestId: requestId, status: "success", data: responseData };
        writeResponse(successResponse);
      }
    } catch (error: any) {
      if (!requestId && line) { const idMatch = line.match(/"requestId"\s*:\s*"([^"]+)"/); if (idMatch && idMatch[1]) { requestId = idMatch[1]; } }
      console.error(`[${new Date().toISOString()}] Failed to process request. Line: ${line}. Error:`, error.message, error.stack);
      const errorCode = error.message?.startsWith("Invalid parameters:") ? "INVALID_PARAMS" : "PROCESSING_ERROR";
      const errorResponse: McpErrorResponse = { requestId: requestId || 'unknown', status: "error", error: { message: error.message || "Invalid JSON input or processing error.", code: errorCode } };
      writeResponse(errorResponse);
    }
  });
  rl.on('close', () => { console.error(`[${new Date().toISOString()}] MCP STDIO Server input stream closed. Exiting.`); process.exit(0); });
}
main();
