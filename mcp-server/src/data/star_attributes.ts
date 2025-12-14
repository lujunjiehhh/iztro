// mcp-server/src/data/star_attributes.ts

export interface StaticStarAttribute {
  wuxing: string; // Five Elements
  yinYang: '阴' | '阳' | '';
  lucky: string; // Basic Lucky/Unlucky tendency (e.g., 吉, 凶)
  keywords: string;
}

export const StarAttributes: Record<string, StaticStarAttribute> = {
  // 14 Major Stars (Zhu Xing)
  "紫微": { wuxing: "土", yinYang: "阴", lucky: "吉", keywords: "尊贵, 领导, 解厄, 官禄主" },
  "天机": { wuxing: "木", yinYang: "阴", lucky: "吉", keywords: "智慧, 谋略, 变动, 兄弟主" },
  "太阳": { wuxing: "火", yinYang: "阳", lucky: "吉", keywords: "光明, 博爱, 权贵, 官禄主" },
  "武曲": { wuxing: "金", yinYang: "阴", lucky: "吉", keywords: "刚毅, 果断, 财星, 财帛主" },
  "天同": { wuxing: "水", yinYang: "阳", lucky: "吉", keywords: "福气, 温顺, 享受, 福德主" },
  "廉贞": { wuxing: "火", yinYang: "阴", lucky: "次吉", keywords: "桃花, 偏激, 政治, 官禄主" },
  "天府": { wuxing: "土", yinYang: "阳", lucky: "吉", keywords: "财库, 稳重, 延寿, 财帛主" },
  "太阴": { wuxing: "水", yinYang: "阴", lucky: "吉", keywords: "柔顺, 洁癖, 财富, 财帛主, 田宅主" },
  "贪狼": { wuxing: "木", yinYang: "阳", lucky: "次凶", keywords: "欲望, 桃花, 多才, 祸福主" },
  "巨门": { wuxing: "水", yinYang: "阴", lucky: "凶", keywords: "口舌, 是非, 怀疑, 暗曜" },
  "天相": { wuxing: "水", yinYang: "阳", lucky: "吉", keywords: "印星, 辅助, 正义, 官禄主" },
  "天梁": { wuxing: "土", yinYang: "阳", lucky: "吉", keywords: "荫星, 老人, 医药, 父母主" },
  "七杀": { wuxing: "金", yinYang: "阳", lucky: "凶", keywords: "肃杀, 开创, 孤独, 将星" },
  "破军": { wuxing: "水", yinYang: "阴", lucky: "凶", keywords: "破坏, 消耗, 先破后立, 耗星" },

  // Auxiliary Stars (Lucky - Liu Ji)
  "左辅": { wuxing: "土", yinYang: "阳", lucky: "吉", keywords: "助力, 辅佐, 宽厚" },
  "右弼": { wuxing: "水", yinYang: "阴", lucky: "吉", keywords: "助力, 辅佐, 机智" },
  "文昌": { wuxing: "金", yinYang: "阳", lucky: "吉", keywords: "科甲, 正统学术, 礼乐" },
  "文曲": { wuxing: "水", yinYang: "阴", lucky: "吉", keywords: "科甲, 异路功名, 口才, 艺术" },
  "天魁": { wuxing: "火", yinYang: "阳", lucky: "吉", keywords: "阳贵人, 机遇, 正派" },
  "天钺": { wuxing: "火", yinYang: "阴", lucky: "吉", keywords: "阴贵人, 机遇, 桃花" },

  // Auxiliary Stars (Unlucky - Liu Sha)
  "擎羊": { wuxing: "金", yinYang: "阳", lucky: "凶", keywords: "刑伤, 冲突, 刚烈, 攻击" },
  "陀罗": { wuxing: "金", yinYang: "阴", lucky: "凶", keywords: "拖延, 是非, 固执, 暗箭" },
  "火星": { wuxing: "火", yinYang: "阳", lucky: "凶", keywords: "暴躁, 突发, 破坏" },
  "铃星": { wuxing: "火", yinYang: "阴", lucky: "凶", keywords: "阴狠, 记仇, 隐忍" },
  "地空": { wuxing: "火", yinYang: "阴", lucky: "凶", keywords: "空亡, 虚耗, 灵感, 半空折翅" },
  "地劫": { wuxing: "火", yinYang: "阳", lucky: "凶", keywords: "劫财, 损失, 波动, 浪里行舟" },

  // Other Common Stars
  "禄存": { wuxing: "土", yinYang: "阴", lucky: "吉", keywords: "财禄, 稳重, 解厄, 孤" },
  "天马": { wuxing: "火", yinYang: "阳", lucky: "平", keywords: "奔波, 变动, 远行" },

  // Defaults for others
  "DEFAULT": { wuxing: "", yinYang: "", lucky: "", keywords: "" }
};
