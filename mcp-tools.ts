// This file defines the TypeScript interfaces for the iztro backend tools.

// Enums

/**
 * @enum {string}
 * @description Gender options.
 */
export enum Gender {
  Male = "男",
  Female = "女",
}

/**
 * @enum {string}
 * @description WuXingJu (五行局) options.
 * Represents the Five Elements Bureau.
 */
export enum WuXingJu {
  WaterTwo = "水二局",
  WoodThree = "木三局",
  MetalFour = "金四局",
  EarthFive = "土五局",
  FireSix = "火六局",
}

/**
 * @enum {string}
 * @description DiZhi (地支) options.
 * Represents the Earthly Branches.
 */
export enum DiZhi {
  Zi = "子",
  Chou = "丑",
  Yin = "寅",
  Mao = "卯",
  Chen = "辰",
  Si = "巳",
  Wu = "午",
  Wei = "未",
  Shen = "申",
  You = "酉",
  Xu = "戌",
  Hai = "亥",
}

/**
 * @enum {string}
 * @description PalaceName (宫位名称) options.
 * Represents the names of the 12 Palaces in Zi Wei Dou Shu.
 */
export enum PalaceName {
  Ming = "命宫",
  XiongDi = "兄弟宫",
  FuQi = "夫妻宫",
  ZiNv = "子女宫",
  CaiBo = "财帛宫",
  JiE = "疾厄宫",
  QianYi = "迁移宫",
  NuPu = "奴仆宫", // Also known as JiaoYouGong (交友宫)
  GuanLu = "官禄宫",
  TianZhai = "田宅宫",
  FuDe = "福德宫",
  FuMu = "父母宫",
  // ShenGong is not a standard palace but often referred to in relation to one of the 12.
  // We will use the standard 12 palace names for palace-specific data.
}

/**
 * @enum {string}
 * @description TianGan (天干) options.
 * Represents the Heavenly Stems.
 */
export enum TianGan {
  Jia = "甲",
  Yi = "乙",
  Bing = "丙",
  Ding = "丁",
  Wu = "戊",
  Ji = "己",
  Geng = "庚",
  Xin = "辛",
  Ren = "壬",
  Gui = "癸",
}

/**
 * @enum {string}
 * @description StarType (星曜类型) options.
 */
export enum StarType {
  MainStar = "主星",
  MajorAuxiliaryStar = "甲级辅星",
  MinorAuxiliaryStar = "乙级辅星", // Assuming this category, adjust if different
  MajorNegativeStar = "甲级煞星", // Assuming this category, adjust if different
  MinorNegativeStar = "乙级煞星", // Assuming this category, adjust if different
  SiHuaStar = "四化曜", // Lu, Quan, Ke, Ji are transformations, not star types themselves but this indicates a star affected by SiHua
  // Other categories like "杂曜" (Miscellaneous Stars) can be added if needed.
}


/**
 * @enum {string}
 * @description BrightnessLevel (亮度等级) options for stars.
 * Represents the brightness or strength of a star in a palace.
 */
export enum BrightnessLevel {
  Miao = "庙", // Temple (very strong)
  Wang = "旺", // Thriving (strong)
  De = "得", // Gained (moderately strong)
  Li = "利", // Benefit (slightly strong)
  Ping = "平", // Neutral / Average
  Bu = "不", // Not Bright / Weak
  Xian = "陷", // Fallen / Very Weak
}

/**
 * @enum {string}
 * @description WuXing (五行属性) options for stars.
 * Represents the Five Elements attribute of a star.
 */
export enum WuXing {
  Metal = "金",
  Wood = "木",
  Water = "水",
  Fire = "火",
  Earth = "土",
}

/**
 * @enum {string}
 * @description YinYang (阴阳属性) options for stars.
 */
export enum YinYang {
  Yin = "阴",
  Yang = "阳",
}

/**
 * @enum {string}
 * @description BasicLuck (基本吉凶倾向) options for stars.
 */
export enum BasicLuck {
  Good = "吉", // Auspicious
  Bad = "凶", // Inauspicious
  Neutral = "中平", // Neutral
}

/**
 * @enum {string}
 * @description SiHuaType (四化类型) options.
 * Represents the types of transformations (Hua).
 */
export enum SiHuaType {
  Lu = "禄", // Prosperity
  Quan = "权", // Power
  Ke = "科", // Fame/Wisdom
  Ji = "忌", // Obstruction/Negativity
}

// --- System Level Tool Definitions (MCP-SYS) ---

/**
 * @interface InitializeChartOutputData
 * @description Output data for the MCP-SYS-01 Initialize_Chart tool.
 */
export interface InitializeChartOutputData {
  /** @property {boolean} success - Indicates if the chart initialization was successful. */
  success: boolean;
  /**
   * @property {Array<StoredStarCombinationMatch>} [matchedCombinations] - Information about stored star combinations that matched the initialized chart.
   * Will be populated if any stored combinations are found to be true for this chart.
   */
  matchedCombinations?: StoredStarCombinationMatch[];
}

/**
 * @alias InitializeChartFunctionOutput
 * @description Defines the expected output data type for the Initialize_Chart tool.
 * Output: {@link InitializeChartOutputData}
 */
export type InitializeChartFunctionOutput = InitializeChartOutputData;


// Interface Definitions for Tool Outputs (MCP-F01 to MCP-F05)

/**
 * @interface BirthInfo
 * @description Represents basic birth information.
 * Corresponds to the output of Get_Chart_Basics (MCP-F01).
 */
export interface BirthInfo {
  /** @property {string} birthDate - The birth date (e.g., "YYYY-MM-DD"). */
  birthDate: string;
  /** @property {string} birthTime - The birth time (e.g., "HH:MM"). */
  birthTime: string;
  /** @property {Gender} gender - The gender of the individual. */
  gender: Gender;
  /** @property {WuXingJu} wuXingJu - WuXingJu (五行局), the Five Elements Bureau. */
  wuXingJu: WuXingJu;
  /** @property {DiZhi} mingGongDiZhi - MingGongDiZhi (命宫地支), the Earthly Branch of the Life Palace. */
  mingGongDiZhi: DiZhi;
  /** @property {DiZhi} shenGongDiZhi - ShenGongDiZhi (身宫地支), the Earthly Branch of the Body Palace. */
  shenGongDiZhi: DiZhi;
  /** @property {PalaceName} shenGongPalace - ShenGongPalace (身宫所落宫位), the palace where the Body Palace (身宫) is located. */
  shenGongPalace: PalaceName;
}

/**
 * @interface PalaceInfo
 * @description Information about a specific palace.
 * Part of the output for Get_Palace_Info (MCP-F02).
 */
export interface PalaceInfo {
  /** @property {PalaceName} palaceName - The name of the palace (e.g., "命宫"). */
  palaceName: PalaceName;
  /** @property {DiZhi} palaceDiZhi - PalaceDiZhi (宫位地支), the Earthly Branch of this palace. */
  palaceDiZhi: DiZhi;
  /** @property {TianGan} palaceTianGan - PalaceTianGan (宫位天干), the Heavenly Stem of this palace. */
  palaceTianGan: TianGan;
  /** @property {string} coreMeaning - CoreMeaning (核心含义) of the palace. */
  coreMeaning: string;
}

/**
 * @interface StarInPalace
 * @description Information about a star within a palace.
 * Part of the output for Get_Stars_In_Palace (MCP-F03).
 */
export interface StarInPalace {
  /** @property {string} starName - StarName (星曜名称), the name of the star. */
  starName: string; // Using string as there are many stars, enum might be too large or vary.
  /** @property {StarType} starType - StarType (星曜类型), the category of the star. */
  starType: StarType;
}

/**
 * @interface StarAttributes
 * @description Detailed attributes of a star.
 * Corresponds to the output of Get_Star_Attributes (MCP-F04).
 */
export interface StarAttributes {
  /** @property {string} starName - StarName (星曜名称), the name of the star. */
  starName: string;
  /**
   * @property {Record<DiZhi, BrightnessLevel>} brightness - Brightness (庙, 旺, 得, 利, 平, 不, 陷) of the star in each of the 12 DiZhi palaces.
   * Keys are DiZhi enum members (e.g., DiZhi.Zi), values are BrightnessLevel enum members.
   */
  brightness: Record<DiZhi, BrightnessLevel>;
  /** @property {WuXing} wuXing - WuXing (五行属性), the Five Elements attribute of the star. */
  wuXing: WuXing;
  /** @property {YinYang} yinYang - YinYang (阴阳属性), the Yin or Yang nature of the star. */
  yinYang: YinYang;
  /** @property {BasicLuck} basicLuck - BasicLuck (基本吉凶倾向), the general auspicious or inauspicious tendency of the star. */
  basicLuck: BasicLuck;
  /** @property {string[]} characteristics - Characteristics (简要特性关键词), an array of keywords describing the star's characteristics. */
  characteristics: string[];
}

/**
 * @interface NatalSiHuaStar
 * @description Information about a single Natal SiHua (四化) star transformation.
 * Part of the output for Get_Natal_SiHua (MCP-F05).
 */
export interface NatalSiHuaStar {
  /** @property {SiHuaType} siHuaType - SiHuaType (四化类型: Lu, Quan, Ke, Ji). */
  siHuaType: SiHuaType;
  /** @property {string} originalStarName - OriginalStarName (被转化的原星曜), the name of the star that is transformed. */
  originalStarName: string; // Star names can be numerous
  /** @property {PalaceName} palaceLocated - PalaceLocated (该四化星所在的宫位), the palace where this SiHua transformation manifests. */
  palaceLocated: PalaceName;
}

// Input types (if distinct from output types or for clarity) for MCP-F01 to MCP-F05

/**
 * @type GetPalaceInfoInput
 * @description Input for Get_Palace_Info (MCP-F02). Can be a specific palace name or "All".
 */
export type GetPalaceInfoInput = PalaceName | "All";

/**
 * @type GetStarsInPalaceInput
 * @description Input for Get_Stars_In_Palace (MCP-F03). Can be a palace name or its DiZhi.
 */
export type GetStarsInPalaceInput = PalaceName | DiZhi;


// Tool function signature type aliases (optional, for better conceptual organization) for MCP-F01 to MCP-F05

/**
 * @alias GetChartBasicsFunctionOutput
 * @description Defines the expected output type for the Get_Chart_Basics tool.
 * Output: {@link BirthInfo}
 */
export type GetChartBasicsFunctionOutput = BirthInfo;

/**
 * @alias GetPalaceInfoFunctionOutput
 * @description Defines the expected output type for the Get_Palace_Info tool.
 * Input: {@link GetPalaceInfoInput}
 * Output: {@link PalaceInfo} | {@link PalaceInfo}[]
 */
export type GetPalaceInfoFunctionOutput = PalaceInfo | PalaceInfo[];


/**
 * @alias GetStarsInPalaceFunctionOutput
 * @description Defines the expected output type for the Get_Stars_In_Palace tool.
 * Input: {@link GetStarsInPalaceInput}
 * Output: {@link StarInPalace}[]
 */
export type GetStarsInPalaceFunctionOutput = StarInPalace[];

/**
 * @alias GetStarAttributesFunctionOutput
 * @description Defines the expected output type for the Get_Star_Attributes tool.
 * Input: string (StarName)
 * Output: {@link StarAttributes}
 */
export type GetStarAttributesFunctionOutput = StarAttributes;

/**
 * @alias GetNatalSiHuaFunctionOutput
 * @description Defines the expected output type for the Get_Natal_SiHua tool.
 * Output: {@link NatalSiHuaStar}[]
 */
export type GetNatalSiHuaFunctionOutput = NatalSiHuaStar[];

// Helper Types for MCP-R01 to MCP-R04

/**
 * @interface PalaceDescriptor
 * @description Describes a palace with its name and DiZhi (Earthly Branch).
 */
export interface PalaceDescriptor {
  /** @property {PalaceName} name - The name of the palace. */
  name: PalaceName;
  /** @property {DiZhi} diZhi - The Earthly Branch (DiZhi) of the palace. */
  diZhi: DiZhi;
}

/**
 * @type PalaceIdentifierInput
 * @description Input type for functions that accept either a PalaceName or a DiZhi to identify a palace.
 */
export type PalaceIdentifierInput = PalaceName | DiZhi;

// Interface Definitions for Tool Outputs (MCP-R01 to MCP-R04)

/**
 * @interface SanFangSiZhengInfo
 * @description Output for Get_SanFang_SiZheng (MCP-R01).
 * Provides information about the San Fang Si Zheng (三方四正) related palaces.
 */
export interface SanFangSiZhengInfo {
  /** @property {PalaceDescriptor} referencePalace - The palace used as the reference point. */
  referencePalace: PalaceDescriptor;
  /** @property {PalaceDescriptor[]} sanFangPalaces - The three palaces forming the San Fang (三方) with the reference palace. */
  sanFangPalaces: [PalaceDescriptor, PalaceDescriptor, PalaceDescriptor];
  /** @property {PalaceDescriptor} siZhengPalace - The palace directly opposite (四正) to the reference palace. */
  siZhengPalace: PalaceDescriptor;
}

/**
 * @interface AnHePalaceInfo
 * @description Output for Get_AnHe_Palace (MCP-R02).
 * Provides information about the An He (暗合) palace, which is secretly combined with the reference palace.
 */
export interface AnHePalaceInfo {
  /** @property {PalaceDescriptor} referencePalace - The palace used as the reference point. */
  referencePalace: PalaceDescriptor;
  /** @property {PalaceDescriptor} anHePalace - The palace that is secretly combined (暗合) with the reference palace. */
  anHePalace: PalaceDescriptor;
}

/**
 * @interface ChongZhaoPalaceInfo
 * @description Output for Get_ChongZhao_Palace (MCP-R03).
 * Provides information about the Chong Zhao (冲照) palace, which is opposite to the reference palace.
 * Note: This is functionally similar to the SiZhengPalace from SanFangSiZhengInfo.
 */
export interface ChongZhaoPalaceInfo {
  /** @property {PalaceDescriptor} referencePalace - The palace used as the reference point. */
  referencePalace: PalaceDescriptor;
  /** @property {PalaceDescriptor} chongZhaoPalace - The palace that is opposite/colliding (冲照) with the reference palace. */
  chongZhaoPalace: PalaceDescriptor;
}

/**
 * @interface FlankingStarInfo
 * @description Describes a star that is part of a Jia Gong (夹宫) formation.
 */
export interface FlankingStarInfo {
  /** @property {string} starName - The name of the flanking star. */
  starName: string; // Using string as StarName might not cover all possible flanking stars (e.g. Lu Cun, Tian Ma as specific entities)
  /** @property {PalaceDescriptor} starPalace - The palace where this flanking star is located. */
  starPalace: PalaceDescriptor;
}

/**
 * @interface JiaGongInfo
 * @description Output for Get_Jia_Gong_Info (MCP-R04).
 * Provides information about a Jia Gong (夹宫) situation, where a palace is flanked by specific stars.
 * The output is conditional; this interface represents the data if a Jia Gong exists.
 */
export interface JiaGongInfo {
  /** @property {PalaceDescriptor} referencePalace - The palace that is being flanked (夹). */
  referencePalace: PalaceDescriptor;
  /** @property {string} jiaGongType - The type of Jia Gong formation (e.g., "禄马夹印", "羊陀夹忌").
   *  A string is used due to the potentially large number of combinations. An enum could be used if a fixed list is available.
   */
  jiaGongType: string;
  /** @property {[FlankingStarInfo, FlankingStarInfo]} flankingStars - The two stars that are flanking the reference palace. */
  flankingStars: [FlankingStarInfo, FlankingStarInfo];
}


// Input types for MCP-R01 to MCP-R04

/**
 * @type GetSanFangSiZhengInput
 * @description Input for Get_SanFang_SiZheng (MCP-R01).
 */
export type GetSanFangSiZhengInput = PalaceIdentifierInput;

/**
 * @type GetAnHePalaceInput
 * @description Input for Get_AnHe_Palace (MCP-R02).
 */
export type GetAnHePalaceInput = PalaceIdentifierInput;

/**
 * @type GetChongZhaoPalaceInput
 * @description Input for Get_ChongZhao_Palace (MCP-R03).
 */
export type GetChongZhaoPalaceInput = PalaceIdentifierInput;

/**
 * @type GetJiaGongInfoInput
 * @description Input for Get_Jia_Gong_Info (MCP-R04).
 */
export type GetJiaGongInfoInput = PalaceIdentifierInput;


// Tool function signature type aliases for MCP-R01 to MCP-R04

/**
 * @alias GetSanFangSiZhengFunctionOutput
 * @description Defines the expected output type for the Get_SanFang_SiZheng tool.
 * Input: {@link GetSanFangSiZhengInput}
 * Output: {@link SanFangSiZhengInfo}
 */
export type GetSanFangSiZhengFunctionOutput = SanFangSiZhengInfo;

/**
 * @alias GetAnHePalaceFunctionOutput
 * @description Defines the expected output type for the Get_AnHe_Palace tool.
 * Input: {@link GetAnHePalaceInput}
 * Output: {@link AnHePalaceInfo}
 */
export type GetAnHePalaceFunctionOutput = AnHePalaceInfo;

/**
 * @alias GetChongZhaoPalaceFunctionOutput
 * @description Defines the expected output type for the Get_ChongZhao_Palace tool.
 * Input: {@link GetChongZhaoPalaceInput}
 * Output: {@link ChongZhaoPalaceInfo}
 */
export type GetChongZhaoPalaceFunctionOutput = ChongZhaoPalaceInfo;

/**
 * @alias GetJiaGongInfoFunctionOutput
 * @description Defines the expected output type for the Get_Jia_Gong_Info tool.
 * Output is conditional: it's {@link JiaGongInfo} if a Jia Gong situation exists, otherwise likely null or an empty object.
 * The exact "no Jia Gong" scenario should be clarified by the backend documentation. For now, assuming it can be null.
 * Input: {@link GetJiaGongInfoInput}
 * Output: {@link JiaGongInfo} | null
 */
export type GetJiaGongInfoFunctionOutput = JiaGongInfo | null;

// --- Temporal Analysis Layer (MCP-T01 to MCP-T07) ---

/**
 * @enum {string}
 * @description Defines the chart level for analysis (Natal, Decade, Annual).
 * Used in Get_Palace_Stem_SiHua (MCP-T07).
 */
export enum ChartLevel {
  Natal = "Natal", // 本命盘
  Decade = "Decade", // 大限盘
  Annual = "Annual", // 流年盘
}

/**
 * @interface TimeBoundPalaceMapping
 * @description Maps a time-bound palace (Decade or Annual) to its corresponding natal palace,
 * including its Heavenly Stem and Earthly Branch.
 */
export interface TimeBoundPalaceMapping {
  /** @property {string} timePalaceName - The name of the time-bound palace (e.g., "大限命宫", "流年事业宫"). */
  timePalaceName: string;
  /** @property {PalaceName} natalPalaceName - The name of the corresponding natal palace (e.g., "本命疾厄宫"). */
  natalPalaceName: PalaceName;
  /** @property {TianGan} timePalaceTianGan - The Heavenly Stem of this time-bound palace. */
  timePalaceTianGan: TianGan;
  /** @property {DiZhi} timePalaceDiZhi - The Earthly Branch of this time-bound palace. */
  timePalaceDiZhi: DiZhi;
}

// MCP-T01: Get_Decade_Info

/**
 * @type GetDecadeInfoInput
 * @description Input for Get_Decade_Info (MCP-T01). Can be user's age or decade index (0-based or 1-based, needs clarification from backend).
 * Assuming decade index might refer to the sequence of decades (e.g., 1st decade, 2nd decade).
 */
export type GetDecadeInfoInput = { userAge: number } | { decadeIndex: number };

/**
 * @interface DecadeInfo
 * @description Output for Get_Decade_Info (MCP-T01).
 * Provides comprehensive information about a specific decade.
 */
export interface DecadeInfo {
  /** @property {number} decadeStartAge - The starting age of the decade. */
  decadeStartAge: number;
  /** @property {number} decadeEndAge - The ending age of the decade. */
  decadeEndAge: number;
  /** @property {PalaceDescriptor} decadeMingGong - The Ming Gong (命宫) for this decade. */
  decadeMingGong: PalaceDescriptor;
  /** @property {TianGan} decadeMingGongTianGan - The Heavenly Stem of the decade's Ming Gong. */
  decadeMingGongTianGan: TianGan;
  /** @property {TimeBoundPalaceMapping[]} decadePalaces - List of 12 objects, mapping each decade palace to its natal counterpart. */
  decadePalaces: TimeBoundPalaceMapping[];
}

/**
 * @alias GetDecadeInfoFunctionOutput
 * @description Defines the expected output type for the Get_Decade_Info tool.
 * Input: {@link GetDecadeInfoInput}
 * Output: {@link DecadeInfo}
 */
export type GetDecadeInfoFunctionOutput = DecadeInfo;

// MCP-T02: Get_Decade_SiHua

/**
 * @type GetDecadeSiHuaInput
 * @description Input for Get_Decade_SiHua (MCP-T02).
 */
export type GetDecadeSiHuaInput = { decadeMingGongTianGan: TianGan };

/**
 * @interface TemporalSiHuaStar
 * @description Information about a SiHua (四化) star transformation for a specific time period (Decade or Annual).
 * Similar to NatalSiHuaStar, but palaceLocated is a PalaceDescriptor.
 */
export interface TemporalSiHuaStar {
  /** @property {SiHuaType} siHuaType - SiHuaType (四化类型: Lu, Quan, Ke, Ji). */
  siHuaType: SiHuaType;
  /** @property {string} originalStarName - OriginalStarName (被转化的原星曜), the name of the star that is transformed. */
  originalStarName: string;
  /** @property {PalaceDescriptor} palaceLocated - PalaceDescriptor (宫位描述), indicating the name and DiZhi of the NATAL palace where this temporal SiHua transformation manifests. */
  palaceLocated: PalaceDescriptor;
}

/**
 * @alias GetDecadeSiHuaFunctionOutput
 * @description Defines the expected output type for the Get_Decade_SiHua tool.
 * Input: {@link GetDecadeSiHuaInput}
 * Output: {@link TemporalSiHuaStar}[] - An array of 4 SiHua stars.
 */
export type GetDecadeSiHuaFunctionOutput = TemporalSiHuaStar[];

// MCP-T03: Get_Decade_Overlapping_Palaces

/**
 * @type GetDecadeOverlappingPalacesInput
 * @description Input for Get_Decade_Overlapping_Palaces (MCP-T03).
 * This is essentially the `decadePalaces` array from `DecadeInfo`.
 */
export type GetDecadeOverlappingPalacesInput = { decadePalaces: TimeBoundPalaceMapping[] };

/**
 * @interface OverlappingPalaceInfo
 * @description Details an overlap between a time-bound palace and a natal palace.
 * This is identical to TimeBoundPalaceMapping, but named for semantic clarity in MCP-T03's output.
 */
export type OverlappingPalaceInfo = TimeBoundPalaceMapping;

/**
 * @alias GetDecadeOverlappingPalacesFunctionOutput
 * @description Defines the expected output type for the Get_Decade_Overlapping_Palaces tool.
 * Input: {@link GetDecadeOverlappingPalacesInput}
 * Output: {@link OverlappingPalaceInfo}[] - An array of 12 overlapping palace details.
 * This seems to directly return the input `decadePalaces` or a very similar structure.
 */
export type GetDecadeOverlappingPalacesFunctionOutput = OverlappingPalaceInfo[];


// MCP-T04: Get_Annual_Info

/**
 * @type GetAnnualInfoInput
 * @description Input for Get_Annual_Info (MCP-T04).
 */
export type GetAnnualInfoInput = { year: number };

/**
 * @interface AnnualInfo
 * @description Output for Get_Annual_Info (MCP-T04).
 * Provides comprehensive information about a specific year.
 */
export interface AnnualInfo {
  /** @property {TianGan} yearTianGan - The Heavenly Stem of the year. */
  yearTianGan: TianGan;
  /** @property {DiZhi} yearDiZhi - The Earthly Branch of the year. */
  yearDiZhi: DiZhi;
  /** @property {PalaceDescriptor} liuNianMingGong - The Ming Gong (流年命宫) for this year. */
  liuNianMingGong: PalaceDescriptor;
  /** @property {PalaceDescriptor} taiSuiPalace - The Tai Sui (太岁) palace for this year. */
  taiSuiPalace: PalaceDescriptor;
  /** @property {TianGan} liuNianMingGongTianGan - The Heavenly Stem of the annual Ming Gong. */
  liuNianMingGongTianGan: TianGan;
  /** @property {TimeBoundPalaceMapping[]} annualPalaces - List of 12 objects, mapping each annual palace to its natal counterpart. */
  annualPalaces: TimeBoundPalaceMapping[];
}

/**
 * @alias GetAnnualInfoFunctionOutput
 * @description Defines the expected output type for the Get_Annual_Info tool.
 * Input: {@link GetAnnualInfoInput}
 * Output: {@link AnnualInfo}
 */
export type GetAnnualInfoFunctionOutput = AnnualInfo;

// MCP-T05: Get_Annual_SiHua

/**
 * @type GetAnnualSiHuaInput
 * @description Input for Get_Annual_SiHua (MCP-T05).
 */
export type GetAnnualSiHuaInput = { annualTianGan: TianGan };

/**
 * @alias GetAnnualSiHuaFunctionOutput
 * @description Defines the expected output type for the Get_Annual_SiHua tool.
 * Input: {@link GetAnnualSiHuaInput}
 * Output: {@link TemporalSiHuaStar}[] - An array of 4 SiHua stars.
 */
export type GetAnnualSiHuaFunctionOutput = TemporalSiHuaStar[];

// MCP-T06: Get_Annual_Overlapping_Palaces

/**
 * @interface AnnualToNatalOverlap
 * @description Details an overlap between an annual palace and a natal palace.
 */
export interface AnnualToNatalOverlap {
  /** @property {string} annualPalaceName - The name of the annual palace (e.g., "流年命宫"). */
  annualPalaceName: string;
  /** @property {PalaceName} natalPalaceName - The name of the corresponding natal palace. */
  natalPalaceName: PalaceName;
  /** @property {TianGan} annualPalaceTianGan - The Heavenly Stem of this annual palace. */
  annualPalaceTianGan: TianGan;
  /** @property {DiZhi} annualPalaceDiZhi - The Earthly Branch of this annual palace. */
  annualPalaceDiZhi: DiZhi;
}

/**
 * @interface AnnualToDecadeOverlap
 * @description Details an overlap between an annual palace and a decade palace.
 */
export interface AnnualToDecadeOverlap {
  /** @property {string} annualPalaceName - The name of the annual palace (e.g., "流年命宫"). */
  annualPalaceName: string;
  /** @property {string} decadePalaceName - The name of the corresponding decade palace (e.g., "大限事业宫"). */
  decadePalaceName: string; // This is the name of the decade palace itself, like "大限命宫"
  /** @property {TianGan} annualPalaceTianGan - The Heavenly Stem of this annual palace. */
  annualPalaceTianGan: TianGan; // This is the TianGan of the annual palace.
  /** @property {DiZhi} annualPalaceDiZhi - The Earthly Branch of this annual palace. */
  annualPalaceDiZhi: DiZhi; // This is the DiZhi of the annual palace.
}


/**
 * @type GetAnnualOverlappingPalacesInput
 * @description Input for Get_Annual_Overlapping_Palaces (MCP-T06).
 */
export type GetAnnualOverlappingPalacesInput = {
  annualInfo: AnnualInfo;
  decadeInfo: DecadeInfo;
};

/**
 * @interface AnnualOverlappingPalacesInfo
 * @description Output for Get_Annual_Overlapping_Palaces (MCP-T06).
 * Contains lists of overlaps between annual palaces and natal/decade palaces.
 */
export interface AnnualOverlappingPalacesInfo {
  /** @property {AnnualToNatalOverlap[]} annualToNatal - Array of 12 objects detailing overlaps between annual and natal palaces. */
  annualToNatal: AnnualToNatalOverlap[];
  /** @property {AnnualToDecadeOverlap[]} annualToDecade - Array of 12 objects detailing overlaps between annual and decade palaces. */
  annualToDecade: AnnualToDecadeOverlap[];
}

/**
 * @alias GetAnnualOverlappingPalacesFunctionOutput
 * @description Defines the expected output type for the Get_Annual_Overlapping_Palaces tool.
 * Input: {@link GetAnnualOverlappingPalacesInput}
 * Output: {@link AnnualOverlappingPalacesInfo}
 */
export type GetAnnualOverlappingPalacesFunctionOutput = AnnualOverlappingPalacesInfo;

// MCP-T07: Get_Palace_Stem_SiHua

/**
 * @type GetPalaceStemSiHuaInput
 * @description Input for Get_Palace_Stem_SiHua (MCP-T07).
 * ReferencePalace is the source palace of the Fei Xing (飞星).
 */
export type GetPalaceStemSiHuaInput = {
  chartLevel: ChartLevel;
  referencePalace: PalaceIdentifierInput; // Can be PalaceName or DiZhi of the source palace
};

/**
 * @interface FeiSiHuaStarInfo
 * @description Information about a single Fei SiHua (飞四化) star transformation.
 * This describes a star transforming due to a palace's Heavenly Stem and "flying" to another palace.
 */
export interface FeiSiHuaStarInfo {
  /** @property {SiHuaType} siHuaType - The type of transformation (Lu, Quan, Ke, Ji). */
  siHuaType: SiHuaType;
  /** @property {string} originalStarInSourcePalace - The name of the star in the ReferencePalace that is transformed by the ReferencePalace's TianGan. */
  originalStarInSourcePalace: string; // StarName might be too restrictive if it refers to specific stars like "禄存"
  /** @property {PalaceDescriptor} targetPalace - The palace where this FeiSiHua lands. */
  targetPalace: PalaceDescriptor;
  /** @property {string} [affectedStarInTargetPalace] - Optional. If the FeiSiHua lands on and affects another star in the TargetPalace, this is its name. */
  affectedStarInTargetPalace?: string;
}

/**
 * @alias GetPalaceStemSiHuaFunctionOutput
 * @description Defines the expected output type for the Get_Palace_Stem_SiHua tool.
 * Input: {@link GetPalaceStemSiHuaInput}
 * Output: {@link FeiSiHuaStarInfo}[] - An array of 4 Fei SiHua stars.
 */
export type GetPalaceStemSiHuaFunctionOutput = FeiSiHuaStarInfo[];

// --- Advanced Support Layer (MCP-A01 to MCP-A02) ---

// MCP-A01: Query_Astrological_Pattern

/**
 * @interface FullNatalChartContext
 * @description Placeholder for the complex structure representing the full natal chart context.
 * This would include all necessary information like birth details, palace configurations, star placements, SiHua, etc.
 * The exact structure needs to be defined based on the backend's requirements.
 */
export interface FullNatalChartContext {
  // Example properties, to be replaced with actual structure:
  // birthInfo: BirthInfo;
  // palaces: PalaceInfo[];
  // starsInPalaces: Record<PalaceName, StarInPalace[]>;
  // natalSiHua: NatalSiHuaStar[];
  // ... and potentially much more, or simply `any` if the structure is too dynamic or unknown.
  [key: string]: any; // Allows for a flexible structure until fully defined.
}

/**
 * @type QueryAstrologicalPatternInput
 * @description Input for Query_Astrological_Pattern (MCP-A01).
 */
export type QueryAstrologicalPatternInput = {
  chartContext: FullNatalChartContext;
};

/**
 * @interface AstrologicalPatternInfo
 * @description Information about a specific astrological pattern (格局) found in the chart.
 */
export interface AstrologicalPatternInfo {
  /** @property {string} patternName - The name of the astrological pattern (e.g., "七杀朝斗格"). */
  patternName: string;
  /** @property {string[]} constitutingPalacesAndStars - Descriptions of the palaces and stars forming the pattern.
   * (e.g., ["七杀 in 寅宫守命", "紫微 in 申宫 (对宫)"]).
   */
  constitutingPalacesAndStars: string[];
  /** @property {string[]} conditionsMet - List of specific conditions that were met to form this pattern (e.g., ["无煞冲破", "吉星会照"]). */
  conditionsMet: string[];
  /** @property {string} generalInterpretation - General interpretation of this pattern. */
  generalInterpretation: string;
}

/**
 * @alias QueryAstrologicalPatternFunctionOutput
 * @description Defines the expected output type for the Query_Astrological_Pattern tool.
 * Input: {@link QueryAstrologicalPatternInput}
 * Output: {@link AstrologicalPatternInfo}[] - A list of identified astrological patterns.
 */
export type QueryAstrologicalPatternFunctionOutput = AstrologicalPatternInfo[];

// MCP-A02: Query_Star_Combination_Meaning

/**
 * @interface StarCombinationInput
 * @description Input for Query_Star_Combination_Meaning (MCP-A02).
 * Defines a combination of 2-3 key stars and their context.
 */
export interface StarCombinationInput {
  /** @property {string[]} stars - An array of 2 to 3 star names (using string for flexibility, could be a more specific StarName type if available and appropriate). */
  stars: [string, string] | [string, string, string];
  /** @property {string} contextDescription - A textual description of the context, (e.g., "in 巳宫守命", "会照于财帛宫").
   *  This could also include the palace name or DiZhi if a more structured context is needed.
   */
  contextDescription: string;
  // Optionally, provide structured context if the backend supports it:
  // contextPalace?: PalaceIdentifierInput;
  // contextChartLevel?: ChartLevel;
}

/**
 * @type QueryStarCombinationMeaningInput
 * @description Input for the Query_Star_Combination_Meaning tool.
 */
export type QueryStarCombinationMeaningInput = StarCombinationInput;


/**
 * @interface StarCombinationMeaning
 * @description Output for Query_Star_Combination_Meaning (MCP-A02).
 * Provides the interpretation of a specific star combination.
 */
export interface StarCombinationMeaning {
  /** @property {string} interpretationText - The core interpretation text. This might be plain text or formatted rich text. */
  interpretationText: string;
  /** @property {string[]} positivePotentials - List of positive outcomes or characteristics associated with the combination. */
  positivePotentials: string[];
  /** @property {string[]} negativePotentials - List of negative outcomes or challenges associated with the combination. */
  negativePotentials: string[];
  /** @property {string[]} commonManifestations - Common ways this star combination manifests in life. */
  commonManifestations: string[];
}

/**
 * @alias QueryStarCombinationMeaningFunctionOutput
 * @description Defines the expected output type for the Query_Star_Combination_Meaning tool.
 * Input: {@link QueryStarCombinationMeaningInput}
 * Output: {@link StarCombinationMeaning}
 */
export type QueryStarCombinationMeaningFunctionOutput = StarCombinationMeaning;

// console.log("TypeScript definitions for iztro backend tools, including Advanced Support Layer, updated.");

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]

[end of mcp-tools.ts]
