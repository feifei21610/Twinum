/**
 * Twinum 游戏常量（严格对齐 scout/docs/03-game-rules.md）
 */

/** 支持的玩家数范围（MVP 固定 4；支持 3-5 人；2 人局永久不做） */
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 5;
export const MVP_PLAYER_COUNT = 4;

/**
 * 官方牌谱（45 张双面牌的正反面数字组合）
 * 来源：Oink Games《SCOUT!》官方规则书 ver.1.1
 * 格式：[top, bottom]
 *
 * 数字范围 1-10，共 45 张。每张都是唯一的正反面组合。
 * 注意：数字组合是官方设计的，不能随意替换。
 */
export const OFFICIAL_DECK: ReadonlyArray<readonly [number, number]> = [
  // 含 10 的牌（共 9 张）—— 3/4 人局会移除（见下方 CARDS_TO_REMOVE_BY_PLAYER）
  [10, 9], // ⚠️ 3 人局专门移除这一张
  [10, 8],
  [10, 7],
  [10, 6],
  [10, 5],
  [10, 4],
  [10, 3],
  [10, 2],
  [10, 1],
  // 1-9 的组合（36 张）
  [9, 8],
  [9, 7],
  [9, 6],
  [9, 5],
  [9, 4],
  [9, 3],
  [9, 2],
  [9, 1],
  [8, 7],
  [8, 6],
  [8, 5],
  [8, 4],
  [8, 3],
  [8, 2],
  [8, 1],
  [7, 6],
  [7, 5],
  [7, 4],
  [7, 3],
  [7, 2],
  [7, 1],
  [6, 5],
  [6, 4],
  [6, 3],
  [6, 2],
  [6, 1],
  [5, 4],
  [5, 3],
  [5, 2],
  [5, 1],
  [4, 3],
  [4, 2],
  [4, 1],
  [3, 2],
  [3, 1],
  [2, 1],
] as const;

/**
 * 按玩家数应该移除的卡牌索引（针对 OFFICIAL_DECK 的 index）
 *
 * 严格对齐 Oink Games《SCOUT!》官方规则书 ver.1.1 Page 1 Section 2：
 *   - 3 players: remove all cards with "10" on them (9 cards)          → 36 张
 *   - 4 players: remove the 1 card with both "9" and "10" on it        → 44 张
 *   - 5 players: use all cards                                         → 45 张
 *
 * 2 人局 MVP / v2 均不做（官方 2 人局有一套特殊规则，复杂度高且和多人规则分叉）
 *
 * 数学验证（总牌数 = 玩家数 × 手牌数）：
 *   - 3 人局：3 × 12 = 36 ✅ 刚好分完，必有人拿到 [1,2] 那张 → 起始玩家确定
 *   - 4 人局：4 × 11 = 44 ✅（45 不能被 4 整除，所以必须去掉 1 张 [9,10]）
 *   - 5 人局：5 × 9  = 45 ✅
 */
export const CARDS_TO_REMOVE_BY_PLAYER: Record<number, number[]> = {
  3: [0, 1, 2, 3, 4, 5, 6, 7, 8], // 全部含 10 的牌（9 张）
  4: [0], // [10, 9] 那 1 张
  5: [], // 全部使用
};

/** 每位玩家的初始手牌数 */
export const INITIAL_HAND_SIZE_BY_PLAYER: Record<number, number> = {
  3: 12,
  4: 11,
  5: 9,
};

/** 每人 1 个 Scout & Show Chip（官方规则） */
export const INITIAL_SCOUT_AND_SHOW_CHIPS_PER_PLAYER = 1;

/** localStorage key 前缀（避免冲突） */
export const STORAGE_PREFIX = 'twinum:';

/** 默认玩家名 */
export const DEFAULT_HUMAN_NAME = '你';

/**
 * Bot 默认命名（MVP 阶段 4 个 Bot 仅命名差异，决策逻辑完全一致）
 *
 * 顺序：P1 / P2 / P3 / P4 对应 BOT_NAMES[0..3]
 * （在 1 人 + 3 Bot 的 MVP 形态下，人类是 P0，Bot 从 P1 开始）
 *
 * 后续如果要差异化人设，保留 Steady/Rush 的 BotConfigKey 不变，
 * 只改 BOT_NAMES 的文案和头像色即可。
 */
export const BOT_NAMES = ['bot1', 'bot2', 'bot3', 'bot4'] as const;

/** @deprecated 旧单 bot 命名，保留以便兼容现存文档；新代码统一用 BOT_NAMES */
export const BOT_STEADY_NAME = 'Steady';
/** @deprecated 同上 */
export const BOT_RUSH_NAME = 'Rush';
