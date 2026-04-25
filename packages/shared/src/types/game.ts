/**
 * Twinum 游戏核心类型契约
 *
 * 所有引擎、store、UI 均依赖此处定义。严格对齐 scout/docs/03-game-rules.md。
 *
 * 联机预留说明：
 *   - Player 使用数组 + type 字段（'human' | 'bot' | 'remote'），而非写死元组
 *   - 所有状态变化走 Action discriminated union，未来 WebSocket 直接广播
 *   - 引擎纯函数 + 不可变 state，可整体搬到服务端做权威校验
 */

// ========== 卡牌 ==========

/**
 * 单张卡牌
 * - 正反面各印一个 1-10 数字（由牌谱决定，发牌时固定，不会改变）
 * - flipped 表示当前朝上面：
 *   - false → 使用 top 作为"朝上面数字"（参与组合）
 *   - true  → 使用 bottom 作为"朝上面数字"
 */
export interface Card {
  id: string; // 形如 "c-3-7-a"，用于 React key & 追踪
  top: number; // 1-10
  bottom: number; // 1-10
  flipped: boolean;
}

/**
 * 获取卡牌当前"朝上面"的数字（参与所有规则判定）
 */
export function faceValue(card: Card): number {
  return card.flipped ? card.bottom : card.top;
}

// ========== 牌组 ==========

export type CardGroupKind = 'same' | 'run';

/**
 * 一个合法牌组（只可能是相同数字组或连续数字组）
 * - cards 是按"打出时的顺序"保留的（手牌中必须相邻）
 * - minValue = 组内所有 faceValue 的最小值，用于强弱第三级比较
 */
export interface CardGroup {
  kind: CardGroupKind;
  cards: Card[];
  minValue: number;
}

// ========== 玩家 ==========

export type PlayerType = 'human' | 'bot' | 'remote';
export type BotConfigKey = 'STEADY' | 'RUSH';

export interface Player {
  id: string;
  type: PlayerType;
  name: string; // "你" / "Steady" / "Rush"
  avatarColor: string; // Tailwind 友好的颜色标识（如 'cyan' / 'rose'）
  hand: Card[]; // 有序，除 Scout 插入外不可重排
  collectedCards: Card[]; // 已收集的翻面牌（计分用）
  scoutChips: number; // 累计 Scout Chip 数
  scoutShowChipUsed: boolean; // Scout & Show Chip 是否已用（每局限 1 次）
  totalScore: number; // 跨轮累计总分
  botConfigKey?: BotConfigKey; // Bot 玩家必填
}

// ========== 动作 ==========

/**
 * 动作集合（discriminated union）
 * 注意：没有 PASS —— 官方规则每回合必须三选一（Show/Scout/ScoutAndShow）
 */
export type Action =
  | { type: 'SHOW'; cardIndexes: number[] }
  | { type: 'SCOUT'; from: 'left' | 'right'; flip: boolean; insertAt: number }
  | {
      type: 'SCOUT_AND_SHOW';
      scout: { from: 'left' | 'right'; flip: boolean; insertAt: number };
      show: number[]; // 在 scout 插入后，基于新手牌的 index
    }
  | { type: 'FLIP_HAND' }; // 仅回合开局、尚未做任何动作前可用

// ========== 游戏状态 ==========

export type GamePhase = 'dealing' | 'playing' | 'roundEnd' | 'gameEnd';

export interface GameState {
  players: Player[]; // 3-5 人（MVP 固定 3）
  currentPlayerIndex: number; // 当前回合玩家索引
  startingPlayerIndex: number; // 本轮起始玩家（每轮后顺时针 +1）

  activeSet: CardGroup | null; // 场上当前牌组
  activeSetOwnerIndex: number | null; // 谁打出的该牌组（Scout 时给 Chip）

  /**
   * 判断回合结束条件 ii 用：
   *   每当有玩家 Show，重置为 null（并记 lastShowerIndex = 该玩家）
   *   每当有玩家 Scout，将其加入"Scout 过的人"集合
   *   当所有其他玩家都只 Scout 不 Show，回到 lastShowerIndex 时 → 触发条件 ii
   */
  lastShowerIndex: number | null;
  scoutedSinceLastShow: number[]; // 从上次 Show 之后，哪些玩家 Scout 过（index 数组）

  /**
   * 条件 ii 触发者（= 最近一次 Show 的玩家）计分时不扣手牌分
   * 仅在 phase === 'roundEnd' 时有意义
   */
  roundEndConditionTriggerer: number | null;
  roundEndCondition: 'i' | 'ii' | null; // 本轮因哪个条件结束

  round: number; // 1-based
  totalRounds: number; // = players.length
  phase: GamePhase;
  seed: string; // 可复现随机种子
  history: Action[]; // 便于回放 & 调试
  turnInRound: number; // 本轮内已进行的回合数，Flip Hand 可用性判断

  /**
   * 每个玩家本轮是否已做过"动作"（Show/Scout/ScoutAndShow）
   * - 用于判断 FLIP_HAND 是否合法（仅在该玩家本轮还未做任何动作时可翻）
   * - 每轮开始时全部重置为 false
   */
  hasActedThisRound: boolean[];
}

// ========== Bot 配置 ==========

/**
 * Bot 决策参数（v2 规划驱动版，详见 scout/docs/06-bot-behavior.md）
 *
 * MVP 阶段 Steady 和 Rush 使用相同的参数值，仅在 UI（头像/名字/颜色）上区分。
 * 后续需要差异化时，只需在此类型上新增字段。
 */
export interface BotConfig {
  key: BotConfigKey;
  /** Show 动作的基础分倍率，默认 1.0 */
  showPriority: number;
  /** Scout 动作的基础分倍率，默认 1.0 */
  scoutPriority: number;
  /** 选次优解的概率（拟人化失误），默认 0.15 */
  mistakeRate: number;
  /** UI 层思考延迟 [min, max] 毫秒 */
  thinkingTimeMs: [number, number];
}
