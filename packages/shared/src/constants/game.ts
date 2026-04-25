/**
 * Twinum 游戏常量（纯游戏逻辑，前端/服务端共享）
 * 严格对齐 scout/docs/03-game-rules.md
 *
 * 注意：STORAGE_PREFIX 等前端专属常量不在此文件，见 client/src/constants/client.ts
 */

/** 支持的玩家数范围（MVP 固定 4；支持 3-5 人；2 人局永久不做） */
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 5;
export const MVP_PLAYER_COUNT = 4;

/**
 * 官方牌谱（45 张双面牌的正反面数字组合）
 * 来源：Oink Games《SCOUT!》官方规则书 ver.1.1
 * 格式：[top, bottom]
 */
export const OFFICIAL_DECK: ReadonlyArray<readonly [number, number]> = [
  [10, 9],
  [10, 8],
  [10, 7],
  [10, 6],
  [10, 5],
  [10, 4],
  [10, 3],
  [10, 2],
  [10, 1],
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
 * - 3 players: remove all cards with "10" (9 cards) → 36 张
 * - 4 players: remove the card with "9" and "10"   → 44 张
 * - 5 players: use all cards                        → 45 张
 */
export const CARDS_TO_REMOVE_BY_PLAYER: Record<number, number[]> = {
  3: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  4: [0],
  5: [],
};

/** 每位玩家的初始手牌数 */
export const INITIAL_HAND_SIZE_BY_PLAYER: Record<number, number> = {
  3: 12,
  4: 11,
  5: 9,
};

/** 每人 1 个 Scout & Show Chip（官方规则） */
export const INITIAL_SCOUT_AND_SHOW_CHIPS_PER_PLAYER = 1;

/** 默认玩家名 */
export const DEFAULT_HUMAN_NAME = '你';

/**
 * Bot 默认命名
 */
export const BOT_NAMES = ['bot1', 'bot2', 'bot3', 'bot4'] as const;

/** @deprecated 旧单 bot 命名，保留兼容 */
export const BOT_STEADY_NAME = 'Steady';
/** @deprecated 同上 */
export const BOT_RUSH_NAME = 'Rush';
