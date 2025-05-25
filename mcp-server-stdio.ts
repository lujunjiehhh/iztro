/**
 * @file mcp-server-stdio.ts
 * @description Implements a stdio server loop for handling MCP tool requests,
 *              integrating actual iztro logic for F, R, and T-series tools.
 *              A-series tools are handled as per specific requirements (A01 removed, A02 TODO, A03 implemented).
 *              Includes in-memory storage for star combinations and sandboxed JS execution.
 */

import * as readline from 'readline';
import { randomUUID } from 'crypto'; // For unique ID generation
import { VM, VMScript } from 'vm2'; // For sandboxed JS execution
import {
  // Enums from mcp-tools.ts
  PalaceName, DiZhi, TianGan, StarType, BrightnessLevel, WuXing, YinYang, BasicLuck, SiHuaType, Gender, WuXingJu, ChartLevel,
  // MCP Tool Output Types
  BirthInfo, PalaceInfo, StarInPalace, StarAttributes, NatalSiHuaStar,
  SanFangSiZhengInfo, AnHePalaceInfo, ChongZhaoPalaceInfo, JiaGongInfo,
  DecadeInfo, TemporalSiHuaStar, OverlappingPalaceInfo, AnnualInfo, AnnualOverlappingPalacesInfo, FeiSiHuaStarInfo,
  StarCombinationMeaning, // MCP-A02 Output
  InitializeChartOutputData, // MCP-SYS-01 Output
  StoreStarCombinationMeaningOutputData, // MCP-A03 Output
  StoredStarCombinationMatch, // Used in InitializeChartOutputData
  // MCP Tool Input Helper Types
  PalaceDescriptor, PalaceIdentifierInput, 
  // @ts-eslint/no-unused-vars: FlankingStarInfo, 
  TimeBoundPalaceMapping, 
  // @ts-eslint/no-unused-vars: FullNatalChartContext, 
  StarCombinationInput,
  // MCP-A03 Types
  StoredStarCombination, StoreStarCombinationMeaningInputParams,
} from './mcp-tools';

// Iztro imports
import { withOptions, FunctionalAstrolabe, FunctionalPalace, 
  // @ts-eslint/no-unused-vars: FunctionalStar, 
  // @ts-eslint/no-unused-vars: SurroundedPalaces 
} from '../src/astro';
import { Option, HeavenlyStemKey as IzHeavenlyStemKey, EarthlyBranchKey as IzEarthlyBranchKey, StarKey as IzStarKey, PalaceKey as IzPalaceKey, BrightnessKey as IzBrightnessKey, FiveElementsClassKey as IzFiveElementsClassKey, StarCategoryKey as IzStarCategoryKey, MutagenKey as IzMutagenKey, FiveElementsKey as IzFiveElementsKey, YinYangKey as IzYinYangKey, HoroscopePalace as IzHoroscopePalace } from '../src/data/types';
import { STARS_INFO } from '../src/data/stars';
import { starKeyToName, palaceKeyToName } from '../src/i18n';

// --- Global State for Chart Context ---
let currentAstrolabe: FunctionalAstrolabe | null = null;
let chartOptions: Option | null = null;

// --- In-memory storage for Star Combinations ---
let storedCombinations: StoredStarCombination[] = [];

// --- McpRequest & Response Interfaces ---
interface McpRequest { requestId: string; toolId: string; params: any; }
interface McpErrorResponse { requestId: string | null; status: "error"; error: { message: string; code: string; }; }
interface McpSuccessResponse { requestId: string; status: "success"; data: any; }

function writeResponse(response: McpErrorResponse | McpSuccessResponse): void {
  process.stdout.write(JSON.stringify(response) + '\n');
}

// --- Star Combination Storage Helper Functions ---
function addStoredCombination(comboData: StoreStarCombinationMeaningInputParams): { success: boolean, id: string } {
  const generatedId = randomUUID();
  const newCombination: StoredStarCombination = { id: generatedId, combinationName: comboData.combinationName, jsCode: comboData.jsCode, meaning: comboData.meaning, relatedCharts: comboData.relatedCharts || [] };
  storedCombinations.push(newCombination);
  console.error(`[${new Date().toISOString()}] Added star combination: ${newCombination.combinationName} (ID: ${generatedId})`);
  return { success: true, id: generatedId };
}
// @ts-eslint/no-unused-vars: function getStoredCombinationById(id: string): StoredStarCombination | undefined { return storedCombinations.find(combo => combo.id === id); }
function getAllStoredCombinations(): StoredStarCombination[] { return [...storedCombinations]; }


// --- Sandboxed JavaScript Execution ---
/**
 * Executes JavaScript code in a sandboxed environment with access to the astrolabe instance.
 * @param {string} jsCode - The JavaScript code string (should be the body of a function).
 * @param {FunctionalAstrolabe} astrolabe - The FunctionalAstrolabe instance for the current chart.
 * @returns {boolean} True if the code executes and returns true, false otherwise (including errors).
 */
function executeCombinationJsCode(jsCode: string, astrolabe: FunctionalAstrolabe): boolean {
  const sandbox = {
    currentAstrolabe: astrolabe, 
    console: { 
        log: (...args: any[]) => console.error('[Sandbox Log]', ...args),
        error: (...args: any[]) => console.error('[Sandbox Error]', ...args),
    }
  };

  const vm = new VM({
    timeout: 100, 
    sandbox: sandbox,
    eval: false,    
    wasm: false,    
    fixAsync: true, 
    sandbox:{ 
        ...sandbox, 
        require: undefined, 
        process: undefined, 
        module: undefined,
        exports: undefined,
    }
  });

  try {
    const scriptToRun = `
      (function(astrolabe) {
        "use strict";
        ${jsCode}
      })(currentAstrolabe); 
    `;
    
    const script = new VMScript(scriptToRun, { filename: 'llm_combination_code.js' });
    const result = vm.run(script);
    return typeof result === 'boolean' ? result : false;
  } catch (e: any) {
    console.error(`[Sandbox Execution Error] for code "${jsCode.substring(0, 100)}...":`, e.message, e.stack ? `\nStack: ${e.stack}` : '');
    return false;
  }
}


// --- Mapping Utilities ---
const izPalaceKeyToMcpPalaceName: Record<IzPalaceKey, PalaceName> = { ming: PalaceName.Ming, xiongdi: PalaceName.XiongDi, fuqi: PalaceName.FuQi, zinv: PalaceName.ZiNv, caibo: PalaceName.CaiBo, jie: PalaceName.JiE, qianyi: PalaceName.QianYi, nupu: PalaceName.NuPu, guanlu: PalaceName.GuanLu, tianzhai: PalaceName.TianZhai, fude: PalaceName.FuDe, fumu: PalaceName.FuMu, shen: PalaceName.Ming };
const mcpPalaceNameToIzPalaceKey = Object.fromEntries(Object.entries(izPalaceKeyToMcpPalaceName).map(([k, v]) => [v, k])) as Record<PalaceName, IzPalaceKey>;
const izEarthlyBranchKeyToMcpDiZhi: Record<IzEarthlyBranchKey, DiZhi> = { zi: DiZhi.Zi, chou: DiZhi.Chou, yin: DiZhi.Yin, mao: DiZhi.Mao, chen: DiZhi.Chen, si: DiZhi.Si, wu: DiZhi.Wu, wei: DiZhi.Wei, shen: DiZhi.Shen, you: DiZhi.You, xu: DiZhi.Xu, hai: DiZhi.Hai };
const mcpDiZhiToIzEarthlyBranchKey = Object.fromEntries(Object.entries(izEarthlyBranchKeyToMcpDiZhi).map(([k, v]) => [v, k])) as Record<DiZhi, IzEarthlyBranchKey>;
const izHeavenlyStemKeyToMcpTianGan: Record<IzHeavenlyStemKey, TianGan> = { jia: TianGan.Jia, yi: TianGan.Yi, bing: TianGan.Bing, ding: TianGan.Ding, wu: TianGan.Wu, ji: TianGan.Ji, geng: TianGan.Geng, xin: TianGan.Xin, ren: TianGan.Ren, gui: TianGan.Gui };
const mcpTianGanToIzHeavenlyStemKey = Object.fromEntries(Object.entries(izHeavenlyStemKeyToMcpTianGan).map(([k,v]) => [v,k])) as Record<TianGan, IzHeavenlyStemKey>;
const izBrightnessKeyToMcpBrightnessLevel: Record<IzBrightnessKey, BrightnessLevel> = { miao: BrightnessLevel.Miao, wang: BrightnessLevel.Wang, de: BrightnessLevel.De, li: BrightnessLevel.Li, ping: BrightnessLevel.Ping, bu: BrightnessLevel.Bu, xian: BrightnessLevel.Xian };
const izStarCategoryToMcpStarType: Record<IzStarCategoryKey, StarType> = { major: StarType.MainStar, minor: StarType.MinorAuxiliaryStar, auxiliary: StarType.MajorAuxiliaryStar, adjective: StarType.MinorAuxiliaryStar, Hua: StarType.SiHuaStar };
const izMutagenToMcpSiHuaType: Record<IzMutagenKey, SiHuaType> = { Lu: SiHuaType.Lu, Quan: SiHuaType.Quan, Ke: SiHuaType.Ke, Ji: SiHuaType.Ji };
const izGenderToMcpGender: Record<"男" | "女", Gender> = { "男": Gender.Male, "女": Gender.Female };
const izFiveElementsClassKeyToMcpWuXingJu: Record<IzFiveElementsClassKey, WuXingJu> = { shuiErJu: WuXingJu.WaterTwo, muSanJu: WuXingJu.WoodThree, jinSiJu: WuXingJu.MetalFour, tuWuJu: WuXingJu.EarthFive, huoLiuJu: WuXingJu.FireSix };
const izFiveElementsKeyToMcpWuXing: Record<IzFiveElementsKey, WuXing> = { metal: WuXing.Metal, wood: WuXing.Wood, water: WuXing.Water, fire: WuXing.Fire, earth: WuXing.Earth };
const izYinYangKeyToMcpYinYang: Record<IzYinYangKey, YinYang> = { yin: YinYang.Yin, yang: YinYang.Yang };
const orderedIzDiZhiKeys: IzEarthlyBranchKey[] = ["yin", "mao", "chen", "si", "wu", "wei", "shen", "you", "xu", "hai", "zi", "chou"];
const mcpStarNameToIzStarKeyMap: Record<string, IzStarKey> = { "紫微": "ziweiMaj", "天机": "tianjiMaj", "太阳": "taiyangMaj", "武曲": "wuquMaj", "天同": "tiantongMaj", "廉贞": "lianzhenMaj", "天府": "tianfuMaj", "太阴": "taiyinMaj", "贪狼": "tanlangMaj", "巨门": "jumenMaj", "天相": "tianxiangMaj", "天梁": "tianliangMaj", "七杀": "qishaMaj", "破军": "pojunMaj", "左辅": "zuofuAux", "右弼": "youbiAux", "文昌": "wenchangAux", "文曲": "wenquAux", "禄存": "lucunAux", "天马": "tianmaAux", "擎羊": "qingyangAug", "陀罗": "tuoluoAug", "火星": "huoxingMin", "铃星": "lingxingMin", "天空": "tiankongMin", "地劫": "dijieMin", };
function getIzStarKey(mcpStarNameOrIzStarKey: string): IzStarKey { if (mcpStarNameToIzStarKeyMap[mcpStarNameOrIzStarKey]) { return mcpStarNameToIzStarKeyMap[mcpStarNameOrIzStarKey]; } if (Object.keys(STARS_INFO).includes(mcpStarNameOrIzStarKey)) { return mcpStarNameOrIzStarKey as IzStarKey; } console.warn(`[getIzStarKey] Star name/key "${mcpStarNameOrIzStarKey}" not found. Using as key (likely incorrect).`); return mcpStarNameOrIzStarKey as IzStarKey; }
function mapFunctionalPalaceToMcpPalaceDescriptor(izPalace: FunctionalPalace | IzHoroscopePalace): PalaceDescriptor { return { name: izPalaceKeyToMcpPalaceName[izPalace.key], diZhi: izEarthlyBranchKeyToMcpDiZhi[izPalace.earthlyBranchKey], tianGan: izHeavenlyStemKeyToMcpTianGan[izPalace.heavenlyStemKey] }; }
function isValidPalaceIdentifier(identifier: any): identifier is PalaceIdentifierInput { return typeof identifier === 'string' && (Object.values(PalaceName).includes(identifier as PalaceName) || Object.values(DiZhi).includes(identifier as DiZhi)); }
function getIzPalaceKeyFromMcpIdentifier(mcpIdentifier: PalaceIdentifierInput): IzPalaceKey { if (Object.values(PalaceName).includes(mcpIdentifier as PalaceName)) { return mcpPalaceNameToIzPalaceKey[mcpIdentifier as PalaceName]; } else if (Object.values(DiZhi).includes(mcpIdentifier as DiZhi)) { const targetDiZhiKey = mcpDiZhiToIzEarthlyBranchKey[mcpIdentifier as DiZhi]; const foundPalace = currentAstrolabe?.palaces.find(p => p.earthlyBranchKey === targetDiZhiKey); if (foundPalace) { return foundPalace.key; } throw new Error(`Invalid parameters: No palace found for DiZhi ${mcpIdentifier}`); } throw new Error(`Invalid PalaceIdentifier for IzPalaceKey mapping: ${mcpIdentifier}`); }

// --- SYSTEM TOOL HANDLER ---
function handleInitializeChart(params: any): InitializeChartOutputData { 
  if (!params || typeof params.birthDate !== 'string' || typeof params.birthTimeIndex !== 'number' || typeof params.gender !== 'string') { throw new Error("Invalid parameters: birthDate (string), birthTimeIndex (number), gender (string) are required."); } 
  if (!["男", "女"].includes(params.gender)) { throw new Error("Invalid parameters: gender must be '男' or '女'."); } 
  if (params.birthTimeIndex < 0 || params.birthTimeIndex > 12) { throw new Error("Invalid parameters: birthTimeIndex must be between 0 and 12.");} 
  const isLunar = typeof params.isLunar === 'boolean' ? params.isLunar : false; 
  const iztroOption: Option = { dateStr: params.birthDate, timeIndex: params.birthTimeIndex, gender: params.gender as "男" | "女", isSolar: !isLunar, fixLeap: typeof params.fixLeap === 'boolean' ? params.fixLeap : true }; 
  
  try { 
    currentAstrolabe = withOptions(iztroOption); 
    chartOptions = iztroOption; 
    console.error(`[${new Date().toISOString()}] Chart initialized successfully for: ${params.birthDate}`);
    
    let matchedCombinationsOutput: StoredStarCombinationMatch[] = [];
    if (currentAstrolabe) {
        const allCombinations = getAllStoredCombinations();
        console.error(`[Auto-Execution] Found ${allCombinations.length} stored combinations to check.`);

        for (const combo of allCombinations) {
            console.error(`[Auto-Execution] Checking combination: ${combo.combinationName} (ID: ${combo.id})`);
            const isMatch = executeCombinationJsCode(combo.jsCode, currentAstrolabe);
            if (isMatch) {
                console.error(`[Auto-Execution] MATCH! Combination: ${combo.combinationName}`);
                matchedCombinationsOutput.push({
                    name: combo.combinationName,
                    meaning: combo.meaning,
                    id: combo.id,
                });
            }
        }
    }
    return { 
        success: true,
        matchedCombinations: matchedCombinationsOutput.length > 0 ? matchedCombinationsOutput : undefined
    }; 
  } catch (error: any) { 
    console.error(`[${new Date().toISOString()}] Error initializing chart with iztro:`, error); 
    currentAstrolabe = null; // Reset on failure
    chartOptions = null;
    throw new Error(`Failed to initialize chart with iztro: ${error.message}`); 
  } 
}

// --- Tool Handlers ---
function ensureChartInitialized(): void { if (!currentAstrolabe || !chartOptions) { throw new Error("CHART_NOT_INITIALIZED: Chart not initialized. Call MCP-SYS-01 Initialize_Chart first."); } }

// MCP-F Series
function handleGetChartBasics(_params: any): BirthInfo { ensureChartInitialized(); const birthTimeApprox = `${String(Math.floor(chartOptions!.timeIndex / 2) + (chartOptions!.timeIndex === 0 ? 23 : -1)).padStart(2, '0')}:00 (approx)`; return { birthDate: chartOptions!.dateStr, birthTime: birthTimeApprox, gender: izGenderToMcpGender[chartOptions!.gender], wuXingJu: izFiveElementsClassKeyToMcpWuXingJu[currentAstrolabe!.fiveElementClass], mingGongDiZhi: izEarthlyBranchKeyToMcpDiZhi[currentAstrolabe!.palace("命宫").earthlyBranchKey], shenGongDiZhi: izEarthlyBranchKeyToMcpDiZhi[currentAstrolabe!.bodyPalace!.earthlyBranchKey], shenGongPalace: izPalaceKeyToMcpPalaceName[currentAstrolabe!.bodyPalace!.key] }; }
function handleGetPalaceInfo(params: { palaceName?: PalaceName | "All" }): PalaceInfo | PalaceInfo[] { ensureChartInitialized(); if (!params || typeof params.palaceName !== 'string' || params.palaceName.trim() === "") { throw new Error("Invalid parameters: palaceName parameter is required and must be a non-empty string."); } if (params.palaceName !== "All" && !Object.values(PalaceName).includes(params.palaceName as PalaceName)) { throw new Error(`Invalid parameters: Invalid palaceName: '${params.palaceName}'. Must be "All" or a valid PalaceName enum member.`); } const mapPalace = (izPalace: FunctionalPalace): PalaceInfo => ({ palaceName: izPalaceKeyToMcpPalaceName[izPalace.key], palaceDiZhi: izEarthlyBranchKeyToMcpDiZhi[izPalace.earthlyBranchKey], palaceTianGan: izHeavenlyStemKeyToMcpTianGan[izPalace.heavenlyStemKey], coreMeaning: `TODO: Core meaning for ${izPalaceKeyToMcpPalaceName[izPalace.key]}` }); if (params.palaceName === "All") { return currentAstrolabe!.palaces.map(p => mapPalace(p)); } else { const izPalaceKey = mcpPalaceNameToIzPalaceKey[params.palaceName as PalaceName]; const izPalace = currentAstrolabe!.palace(izPalaceKey); return mapPalace(izPalace); } }
function handleGetStarsInPalace(params: { palaceIdentifier?: PalaceIdentifierInput }): StarInPalace[] { ensureChartInitialized(); if (!params || !isValidPalaceIdentifier(params.palaceIdentifier)) { throw new Error("Invalid parameters: palaceIdentifier parameter is required and must be a valid PalaceName or DiZhi."); } let izPalace: FunctionalPalace; if (Object.values(PalaceName).includes(params.palaceIdentifier as PalaceName)) { izPalace = currentAstrolabe!.palace(mcpPalaceNameToIzPalaceKey[params.palaceIdentifier as PalaceName]); } else { const targetDiZhiKey = mcpDiZhiToIzEarthlyBranchKey[params.palaceIdentifier as DiZhi]; const foundPalace = currentAstrolabe!.palaces.find(p => p.earthlyBranchKey === targetDiZhiKey); if (!foundPalace) throw new Error(`Invalid parameters: No palace found for DiZhi ${params.palaceIdentifier}`); izPalace = foundPalace; } return izPalace.stars.map(star => ({ starName: star.name, starType: izStarCategoryToMcpStarType[star.type] || StarType.MinorAuxiliaryStar })); }
function handleGetStarAttributes(params: { starName?: string }): StarAttributes { ensureChartInitialized(); if (!params || typeof params.starName !== 'string' || params.starName.trim() === "") { throw new Error("Invalid parameters: starName parameter is required and must be a non-empty string."); } const izStarKey = getIzStarKey(params.starName); const starInfo = STARS_INFO[izStarKey]; if (!starInfo) throw new Error(`Invalid parameters: Star attributes not found for '${params.starName}' (key: '${izStarKey}').`); const brightness: Record<DiZhi, BrightnessLevel> = {} as Record<DiZhi, BrightnessLevel>; orderedIzDiZhiKeys.forEach((izDiZhiKey, index) => { const mcpDiZhi = izEarthlyBranchKeyToMcpDiZhi[izDiZhiKey]; const izBrightness = starInfo.brightness[index]; brightness[mcpDiZhi] = izBrightnessKeyToMcpBrightnessLevel[izBrightness]; }); return { starName: params.starName, brightness: brightness, wuXing: izFiveElementsKeyToMcpWuXing[starInfo.fiveElements], yinYang: izYinYangKeyToMcpYinYang[starInfo.yinYang], basicLuck: BasicLuck.Neutral, characteristics: [`TODO: Characteristic for ${params.starName}`] }; }
function handleGetNatalSiHua(_params: any): NatalSiHuaStar[] { ensureChartInitialized(); const sihuaStars: NatalSiHuaStar[] = []; currentAstrolabe!.mudanStars.forEach(star => { if (star.mutagen) { sihuaStars.push({ siHuaType: izMutagenToMcpSiHuaType[star.mutagen], originalStarName: star.name, palaceLocated: izPalaceKeyToMcpPalaceName[star.palaceName as IzPalaceKey] }); } }); return sihuaStars; }

// MCP-R Series
function handleGetSanFangSiZheng(params: { referencePalaceIdentifier?: PalaceIdentifierInput }): SanFangSiZhengInfo { ensureChartInitialized(); if (!params || !isValidPalaceIdentifier(params.referencePalaceIdentifier)) { throw new Error("Invalid parameters: referencePalaceIdentifier is required and must be a valid PalaceName or DiZhi."); } const izPalaceKey = getIzPalaceKeyFromMcpIdentifier(params.referencePalaceIdentifier); const sfsz = currentAstrolabe!.surroundedPalaces(izPalaceKey); const mappedTarget = mapFunctionalPalaceToMcpPalaceDescriptor(currentAstrolabe!.palace(sfsz.target.key)); const mappedOpposite = mapFunctionalPalaceToMcpPalaceDescriptor(currentAstrolabe!.palace(sfsz.opposite.key)); const mappedWealth = mapFunctionalPalaceToMcpPalaceDescriptor(currentAstrolabe!.palace(sfsz.palaceOfWealth.key)); const mappedCareer = mapFunctionalPalaceToMcpPalaceDescriptor(currentAstrolabe!.palace(sfsz.palaceOfCareer.key)); return { referencePalace: mappedTarget, sanFangPalaces: [mappedTarget, mappedWealth, mappedCareer], siZhengPalace: mappedOpposite }; }
function handleGetAnHePalace(params: { referencePalaceIdentifier?: PalaceIdentifierInput }): AnHePalaceInfo { ensureChartInitialized(); if (!params || !isValidPalaceIdentifier(params.referencePalaceIdentifier)) { throw new Error("Invalid parameters: referencePalaceIdentifier is required and must be a valid PalaceName or DiZhi."); } const izRefPalaceKey = getIzPalaceKeyFromMcpIdentifier(params.referencePalaceIdentifier); const refPalace = currentAstrolabe!.palace(izRefPalaceKey); const anHePairs: Record<IzHeavenlyStemKey, IzHeavenlyStemKey> = { jia: 'ji', yi: 'geng', bing: 'xin', ding: 'ren', wu: 'gui', ji: 'jia', geng: 'yi', xin: 'bing', ren: 'ding', gui: 'wu' }; const partnerStemKey = anHePairs[refPalace.heavenlyStemKey]; if (!partnerStemKey) { throw new Error(`AnHe partner not defined for Heavenly Stem: ${refPalace.heavenlyStemKey}`); } const anHePalaceInstance = currentAstrolabe!.palaces.find(p => p.heavenlyStemKey === partnerStemKey); if (!anHePalaceInstance) { throw new Error(`AnHe partner palace not found for Heavenly Stem Key: ${partnerStemKey}`); } return { referencePalace: mapFunctionalPalaceToMcpPalaceDescriptor(refPalace), anHePalace: mapFunctionalPalaceToMcpPalaceDescriptor(anHePalaceInstance) }; }
function handleGetChongZhaoPalace(params: { referencePalaceIdentifier?: PalaceIdentifierInput }): ChongZhaoPalaceInfo { ensureChartInitialized(); if (!params || !isValidPalaceIdentifier(params.referencePalaceIdentifier)) { throw new Error("Invalid parameters: referencePalaceIdentifier is required and must be a valid PalaceName or DiZhi."); } const izPalaceKey = getIzPalaceKeyFromMcpIdentifier(params.referencePalaceIdentifier); const sfsz = currentAstrolabe!.surroundedPalaces(izPalaceKey); return { referencePalace: mapFunctionalPalaceToMcpPalaceDescriptor(currentAstrolabe!.palace(sfsz.target.key)), chongZhaoPalace: mapFunctionalPalaceToMcpPalaceDescriptor(currentAstrolabe!.palace(sfsz.opposite.key)) }; }
const jiaGongStarPatterns: Array<{ type: string; star1Key: IzStarKey; star2Key: IzStarKey }> = [ { type: "羊陀夹", star1Key: "qingyangAug", star2Key: "tuoluoAug" }, { type: "火铃夹", star1Key: "huoxingMin", star2Key: "lingxingMin" }, { type: "左右夹", star1Key: "zuofuAux", star2Key: "youbiAux" }, { type: "昌曲夹", star1Key: "wenchangAux", star2Key: "wenquAux" }, ];
function palaceHasStar(palace: FunctionalPalace, izStarKey: IzStarKey): boolean { return palace.stars.some(s => s.key === izStarKey); }
function handleGetJiaGongInfo(params: { referencePalaceIdentifier?: PalaceIdentifierInput }): JiaGongInfo | null { ensureChartInitialized(); if (!params || !isValidPalaceIdentifier(params.referencePalaceIdentifier)) { throw new Error("Invalid parameters: referencePalaceIdentifier is required and must be a valid PalaceName or DiZhi."); } const izPalaceKey = getIzPalaceKeyFromMcpIdentifier(params.referencePalaceIdentifier); const targetPalace = currentAstrolabe!.palace(izPalaceKey); const prevPalaceIndex = (targetPalace.index - 1 + 12) % 12; const nextPalaceIndex = (targetPalace.index + 1) % 12; const prevPalace = currentAstrolabe!.palaces[prevPalaceIndex]; const nextPalace = currentAstrolabe!.palaces[nextPalaceIndex]; for (const pattern of jiaGongStarPatterns) { const star1InPrev = palaceHasStar(prevPalace, pattern.star1Key); const star2InNext = palaceHasStar(nextPalace, pattern.star2Key); const star2InPrev = palaceHasStar(prevPalace, pattern.star2Key); const star1InNext = palaceHasStar(nextPalace, pattern.star1Key); if ((star1InPrev && star2InNext) || (star2InPrev && star1InNext)) { return { referencePalace: mapFunctionalPalaceToMcpPalaceDescriptor(targetPalace), jiaGongType: pattern.type, flankingStars: [ { starName: starKeyToName(pattern.star1Key, chartOptions?.language || 'zh-CN'), starPalace: mapFunctionalPalaceToMcpPalaceDescriptor(star1InPrev ? prevPalace : nextPalace) }, { starName: starKeyToName(pattern.star2Key, chartOptions?.language || 'zh-CN'), starPalace: mapFunctionalPalaceToMcpPalaceDescriptor(star2InNext ? nextPalace : prevPalace) } ] }; } } return null; }

// MCP-T Series
function handleGetDecadeInfo(params: { userAge?: number; decadeIndex?: number }): DecadeInfo { ensureChartInitialized(); if (!params || (typeof params.userAge !== 'number' && typeof params.decadeIndex !== 'number')) { throw new Error("Invalid parameters: Either userAge (number) or decadeIndex (number) must be provided."); } const iztroHoroscope = currentAstrolabe!.horoscope(undefined, undefined, params.userAge, params.decadeIndex); const decadalHoroscopeItem = iztroHoroscope.decadal; const izDecadeMingPalace = decadalHoroscopeItem.palaces[0]; const decadePalaces: TimeBoundPalaceMapping[] = decadalHoroscopeItem.palaces.map((izTimedPalace: IzHoroscopePalace) => ({ timePalaceName: `大限${palaceKeyToName(izTimedPalace.key, chartOptions?.language || 'zh-CN')}`, natalPalaceName: izPalaceKeyToMcpPalaceName[izTimedPalace.key], timePalaceTianGan: izHeavenlyStemKeyToMcpTianGan[izTimedPalace.heavenlyStemKey], timePalaceDiZhi: izEarthlyBranchKeyToMcpDiZhi[izTimedPalace.earthlyBranchKey] })); return { decadeStartAge: decadalHoroscopeItem.range[0], decadeEndAge: decadalHoroscopeItem.range[1], decadeMingGong: mapFunctionalPalaceToMcpPalaceDescriptor(izDecadeMingPalace as unknown as FunctionalPalace), decadeMingGongTianGan: izHeavenlyStemKeyToMcpTianGan[izDecadeMingPalace.heavenlyStemKey], decadePalaces: decadePalaces }; }
function handleGetDecadeSiHua(params: { decadeMingGongTianGan?: TianGan }): TemporalSiHuaStar[] { ensureChartInitialized(); if (!params || !params.decadeMingGongTianGan || !Object.values(TianGan).includes(params.decadeMingGongTianGan)) { throw new Error("Invalid parameters: decadeMingGongTianGan is required and must be a valid TianGan."); } const izTianGanKey = mcpTianGanToIzHeavenlyStemKey[params.decadeMingGongTianGan]; const izSiHuaStars = currentAstrolabe!.getFourTransformationStars(izTianGanKey); return izSiHuaStars.map(izStar => { const natalStarInstance = currentAstrolabe!.star(izStar.key); if (!natalStarInstance || !natalStarInstance.palaceName) { throw new Error(`Could not find natal palace for star ${izStar.key}`); } const natalPalaceOfStar = currentAstrolabe!.palace(natalStarInstance.palaceName); return { siHuaType: izMutagenToMcpSiHuaType[izStar.mutagen!], originalStarName: izStar.name, palaceLocated: mapFunctionalPalaceToMcpPalaceDescriptor(natalPalaceOfStar) }; }); }
function handleGetDecadeOverlappingPalaces(params: { decadeInfo?: DecadeInfo }): OverlappingPalaceInfo[] { ensureChartInitialized(); if (!params || !params.decadeInfo || !Array.isArray(params.decadeInfo.decadePalaces) || params.decadeInfo.decadePalaces.length === 0) { throw new Error("Invalid parameters: decadeInfo with a non-empty decadePalaces array is required."); } return params.decadeInfo.decadePalaces; }
function handleGetAnnualInfo(params: { year?: number }): AnnualInfo { ensureChartInitialized(); if (!params || typeof params.year !== 'number' || params.year < 1900 || params.year > 2300) { throw new Error("Invalid parameters: year is required and must be a valid number (e.g., 1900-2300)."); } const iztroHoroscope = currentAstrolabe!.horoscope(undefined, params.year); const annualHoroscopeItem = iztroHoroscope.yearly; const izAnnualMingPalace = annualHoroscopeItem.palaces[0]; const annualPalaces: TimeBoundPalaceMapping[] = annualHoroscopeItem.palaces.map((izTimedPalace: IzHoroscopePalace) => ({ timePalaceName: `流年${palaceKeyToName(izTimedPalace.key, chartOptions?.language || 'zh-CN')}`, natalPalaceName: izPalaceKeyToMcpPalaceName[izTimedPalace.key], timePalaceTianGan: izHeavenlyStemKeyToMcpTianGan[izTimedPalace.heavenlyStemKey], timePalaceDiZhi: izEarthlyBranchKeyToMcpDiZhi[izTimedPalace.earthlyBranchKey] })); const taiSuiNatalPalaceKey = currentAstrolabe!.palaces.find(p => p.earthlyBranchKey === annualHoroscopeItem.earthlyBranchKey)!.key; return { yearTianGan: izHeavenlyStemKeyToMcpTianGan[annualHoroscopeItem.heavenlyStemKey], yearDiZhi: izEarthlyBranchKeyToMcpDiZhi[annualHoroscopeItem.earthlyBranchKey], liuNianMingGong: mapFunctionalPalaceToMcpPalaceDescriptor(izAnnualMingPalace as unknown as FunctionalPalace), taiSuiPalace: mapFunctionalPalaceToMcpPalaceDescriptor(currentAstrolabe!.palace(taiSuiNatalPalaceKey)), liuNianMingGongTianGan: izHeavenlyStemKeyToMcpTianGan[izAnnualMingPalace.heavenlyStemKey], annualPalaces: annualPalaces }; }
function handleGetAnnualSiHua(params: { annualTianGan?: TianGan }): TemporalSiHuaStar[] { ensureChartInitialized(); if (!params || !params.annualTianGan || !Object.values(TianGan).includes(params.annualTianGan)) { throw new Error("Invalid parameters: annualTianGan is required and must be a valid TianGan."); } const izTianGanKey = mcpTianGanToIzHeavenlyStemKey[params.annualTianGan]; const izSiHuaStars = currentAstrolabe!.getFourTransformationStars(izTianGanKey); return izSiHuaStars.map(izStar => { const natalStarInstance = currentAstrolabe!.star(izStar.key); if (!natalStarInstance || !natalStarInstance.palaceName) { throw new Error(`Could not find natal palace for star ${izStar.key}`); } const natalPalaceOfStar = currentAstrolabe!.palace(natalStarInstance.palaceName); return { siHuaType: izMutagenToMcpSiHuaType[izStar.mutagen!], originalStarName: izStar.name, palaceLocated: mapFunctionalPalaceToMcpPalaceDescriptor(natalPalaceOfStar) }; }); }
function handleGetAnnualOverlappingPalaces(params: { annualInfo?: AnnualInfo; decadeInfo?: DecadeInfo }): AnnualOverlappingPalacesInfo { ensureChartInitialized(); if (!params || !params.annualInfo || !params.decadeInfo || !Array.isArray(params.annualInfo.annualPalaces) || !Array.isArray(params.decadeInfo.decadePalaces) ) { throw new Error("Invalid parameters: annualInfo and decadeInfo (with their palace arrays) are required."); } const annualToNatal: AnnualToNatalOverlap[] = params.annualInfo.annualPalaces.map(ap => ({ annualPalaceName: ap.timePalaceName, natalPalaceName: ap.natalPalaceName, annualPalaceTianGan: ap.timePalaceTianGan, annualPalaceDiZhi: ap.timePalaceDiZhi })); const annualToDecade: AnnualToDecadeOverlap[] = []; params.annualInfo.annualPalaces.forEach(annualMapping => { const decadeMapping = params.decadeInfo!.decadePalaces.find(dm => dm.natalPalaceName === annualMapping.natalPalaceName); if (decadeMapping) { annualToDecade.push({ annualPalaceName: annualMapping.timePalaceName, decadePalaceName: decadeMapping.timePalaceName, annualPalaceTianGan: annualMapping.timePalaceTianGan, annualPalaceDiZhi: annualMapping.timePalaceDiZhi }); } }); return { annualToNatal, annualToDecade }; }
function handleGetPalaceStemSiHua(params: { chartLevel?: ChartLevel; referencePalace?: PalaceIdentifierInput, yearForAnnualChart?: number }): FeiSiHuaStarInfo[] { ensureChartInitialized(); if (!params || !params.chartLevel || !Object.values(ChartLevel).includes(params.chartLevel)) { throw new Error("Invalid parameters: chartLevel is required and must be a valid ChartLevel."); } if (!isValidPalaceIdentifier(params.referencePalace)) { throw new Error("Invalid parameters: referencePalace is required and must be a valid PalaceName or DiZhi."); } let sourceTianGanKey: IzHeavenlyStemKey; const refIzPalaceKey = getIzPalaceKeyFromMcpIdentifier(params.referencePalace); if (params.chartLevel === ChartLevel.Natal) { sourceTianGanKey = currentAstrolabe!.palace(refIzPalaceKey).heavenlyStemKey; } else { const yearForHoroscope = params.chartLevel === ChartLevel.Annual ? (params.yearForAnnualChart || new Date().getFullYear()) : undefined; const iFuncHoroscope = currentAstrolabe!.horoscope(undefined, yearForHoroscope); const timedChartPalaces = params.chartLevel === ChartLevel.Decade ? iFuncHoroscope.decadal.palaces : iFuncHoroscope.yearly.palaces; const timedSourcePalace = timedChartPalaces.find(p => p.key === refIzPalaceKey); if (!timedSourcePalace) { throw new Error(`Palace ${(_params => params.referencePalace)(params)} not found in ${(_params => params.chartLevel)(params)} chart context.`); } sourceTianGanKey = timedSourcePalace.heavenlyStemKey; } const flyingSiHuaStarsRaw = currentAstrolabe!.getFourTransformationStars(sourceTianGanKey); return flyingSiHuaStarsRaw.map(rawSiHuaStar => { const natalStarInstance = currentAstrolabe!.star(rawSiHuaStar.key); if (!natalStarInstance || !natalStarInstance.palaceName) { throw new Error(`Could not find natal palace for SiHua target star ${rawSiHuaStar.key}`); } const targetNatalPalace = currentAstrolabe!.palace(natalStarInstance.palaceName); return { siHuaType: izMutagenToMcpSiHuaType[rawSiHuaStar.mutagen!], originalStarInSourcePalace: rawSiHuaStar.name, targetPalace: mapFunctionalPalaceToMcpPalaceDescriptor(targetNatalPalace), affectedStarInTargetPalace: undefined }; }); }

// MCP-A Series
async function handleStoreStarCombinationMeaning(params: StoreStarCombinationMeaningInputParams): Promise<StoreStarCombinationMeaningOutputData> {
  if (!params.combinationName || typeof params.combinationName !== 'string' || params.combinationName.trim() === "") {
    throw new Error("Invalid parameters: combinationName must be a non-empty string.");
  }
  if (!params.jsCode || typeof params.jsCode !== 'string' || params.jsCode.trim() === "") {
    throw new Error("Invalid parameters: jsCode must be a non-empty string.");
  }
  if (!params.meaning || typeof params.meaning !== 'string' || params.meaning.trim() === "") {
    throw new Error("Invalid parameters: meaning must be a non-empty string.");
  }
  if (params.relatedCharts && 
      (!Array.isArray(params.relatedCharts) || !params.relatedCharts.every(item => typeof item === 'string'))
     ) {
    throw new Error("Invalid parameters: relatedCharts must be an array of strings if provided.");
  }

  const storeResult = addStoredCombination(params);

  const responseMessages: string[] = [
    "Star combination meaning stored successfully.",
    "You can now reference this combination by its ID when initializing charts.",
    "The jsCode will be executed against future charts to check for matches."
  ];

  return {
    success: storeResult.success,
    id: storeResult.id,
    messages: responseMessages,
  };
}

function handleQueryStarCombinationMeaning(params: StarCombinationInput): StarCombinationMeaning {
  throw new Error("Feature not implemented: Query_Star_Combination_Meaning is a TODO.");
}

/** Main function */
function main(): void {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  console.error(`[${new Date().toISOString()}] MCP STDIO Server started. Listening for requests on stdin...`);
  rl.on('line', async (line) => { // Added async here
    let parsedRequest: McpRequest | null = null;
    let requestId: string | null = null;
    try {
      parsedRequest = JSON.parse(line) as McpRequest;
      requestId = parsedRequest?.requestId || null;
      if (typeof parsedRequest !== 'object' || parsedRequest === null || !parsedRequest.toolId || !requestId) { throw new Error("Request is not a valid MCP request object or missing required fields (requestId, toolId)."); }
      console.error(`[${new Date().toISOString()}] Received request: ${JSON.stringify(parsedRequest)}`);
      let responseData: any;
      let toolFound = true;
      const params = parsedRequest.params === undefined ? {} : parsedRequest.params;
      switch (parsedRequest.toolId) {
        case "MCP-SYS-01": responseData = handleInitializeChart(params); break;
        case "Get_Chart_Basics": responseData = handleGetChartBasics(params); break;
        case "Get_Palace_Info": responseData = handleGetPalaceInfo(params); break;
        case "Get_Stars_In_Palace": responseData = handleGetStarsInPalace(params); break;
        case "Get_Star_Attributes": responseData = handleGetStarAttributes(params); break;
        case "Get_Natal_SiHua": responseData = handleGetNatalSiHua(params); break;
        case "Get_SanFang_SiZheng": responseData = handleGetSanFangSiZheng(params); break;
        case "Get_AnHe_Palace": responseData = handleGetAnHePalace(params); break;
        case "Get_ChongZhao_Palace": responseData = handleGetChongZhaoPalace(params); break;
        case "Get_Jia_Gong_Info": responseData = handleGetJiaGongInfo(params); break;
        case "Get_Decade_Info": responseData = handleGetDecadeInfo(params); break;
        case "Get_Decade_SiHua": responseData = handleGetDecadeSiHua(params); break;
        case "Get_Decade_Overlapping_Palaces": responseData = handleGetDecadeOverlappingPalaces(params); break;
        case "Get_Annual_Info": responseData = handleGetAnnualInfo(params); break;
        case "Get_Annual_SiHua": responseData = handleGetAnnualSiHua(params); break;
        case "Get_Annual_Overlapping_Palaces": responseData = handleGetAnnualOverlappingPalaces(params); break;
        case "Get_Palace_Stem_SiHua": responseData = handleGetPalaceStemSiHua(params); break;
        case "Query_Star_Combination_Meaning": responseData = handleQueryStarCombinationMeaning(params as StarCombinationInput); break;
        case "MCP-A03": responseData = await handleStoreStarCombinationMeaning(params as StoreStarCombinationMeaningInputParams); break;
        default: toolFound = false; const eRes: McpErrorResponse = { requestId: requestId, status: "error", error: { message: `Tool ID '${parsedRequest.toolId}' not found or not yet implemented.`, code: "TOOL_NOT_FOUND" } }; writeResponse(eRes); break;
      }
      if (toolFound) { const sRes: McpSuccessResponse = { requestId: requestId, status: "success", data: responseData }; writeResponse(sRes); }
    } catch (error: any) {
      if (!requestId && line) { const idMatch = line.match(/"requestId"\s*:\s*"([^"]+)"/); if (idMatch && idMatch[1]) { requestId = idMatch[1]; } }
      console.error(`[${new Date().toISOString()}] Failed to process request. Line: ${line}. Error:`, error.message, error.stack);
      let errorCode = "PROCESSING_ERROR";
      if (error.message?.startsWith("Invalid parameters:")) { errorCode = "INVALID_PARAMS"; }
      else if (error.message?.startsWith("CHART_NOT_INITIALIZED:")) { errorCode = "CHART_NOT_INITIALIZED"; }
      else if (error.message?.startsWith("Feature not implemented:")) { errorCode = "NOT_IMPLEMENTED"; } 
      const errorResponse: McpErrorResponse = { requestId: requestId || 'unknown', status: "error", error: { message: error.message || "Invalid JSON input or processing error.", code: errorCode } };
      writeResponse(errorResponse);
    }
  });
  rl.on('close', () => { console.error(`[${new Date().toISOString()}] MCP STDIO Server input stream closed. Exiting.`); process.exit(0); });
}
main();
