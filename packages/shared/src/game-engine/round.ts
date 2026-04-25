/**
 * 回合流转 + 整局流转
 * - startNewGame：初始化一局（发牌、起始玩家、phase=dealing → playing）
 * - startNextRound：进入下一轮（换起始玩家、重置 Chip、重新发牌）
 * - isGameOver：判断整局是否结束
 */
import type { Card, GameState, Player, BotConfigKey } from '../types/game';
import {
  INITIAL_SCOUT_AND_SHOW_CHIPS_PER_PLAYER,
  MVP_PLAYER_COUNT,
  BOT_NAMES,
  DEFAULT_HUMAN_NAME,
} from '../constants/game';
import { createRNG, generateSeed, type RNG } from './rng';
import { dealCards, findStartingPlayerIndex, generateDeck, shuffleDeck } from './deck';
import { applyRoundScoresToTotal, computeRoundScores } from './scoring';

export interface StartGameOptions {
  seed?: string;
  playerCount?: number;
  humanName?: string;
  /**
   * Bot 策略配置数组，按 bot 出现顺序对应。
   * MVP 阶段所有 Bot 决策逻辑相同，仅命名不同，所以此参数主要供单测/未来人设差异化。
   * 缺省时所有 Bot 都用 'STEADY'（反正行为一致）。
   */
  botConfigs?: BotConfigKey[];
  /**
   * 测试/模拟专用：全部玩家都是 Bot（0 个人类）
   *   - 默认 false：P0 是人类、其余是 Bot
   *   - true：所有玩家都是 Bot，命名使用 BOT_NAMES
   */
  allBots?: boolean;
}

export interface StartGameResult {
  state: GameState;
  rng: RNG; // 持有 RNG 供后续发牌/Bot 决策复用；store 会保存 seed 必要时重建
}

/**
 * 初始化一局游戏：洗牌 + 发牌 + 确定起始玩家
 */
export function startNewGame(options: StartGameOptions = {}): StartGameResult {
  const playerCount = options.playerCount ?? MVP_PLAYER_COUNT;
  const seed = options.seed ?? generateSeed();
  const rng = createRNG(seed);

  // 生成并洗牌
  const deck = generateDeck(playerCount);
  const shuffled = shuffleDeck(deck, rng);
  const hands = dealCards(shuffled, playerCount);
  const startingIdx = findStartingPlayerIndex(hands);

  // 构造玩家
  //   生产模式：P0 = 人类，P1..P(n-1) = Bot
  //   all-bot 模式（测试/模拟）：P0..P(n-1) 全是 Bot
  const allBots = options.allBots ?? false;
  const botKeys = options.botConfigs ?? [];
  const players: Player[] = [];
  let botIndex = 0; // 当前是第几个 Bot（用于映射 BOT_NAMES）
  for (let i = 0; i < playerCount; i++) {
    const isHuman = !allBots && i === 0;
    if (isHuman) {
      players.push(
        buildPlayer({
          id: 'p-human',
          type: 'human',
          name: options.humanName ?? DEFAULT_HUMAN_NAME,
          avatarColor: 'primary',
          hand: hands[i],
        }),
      );
    } else {
      const botKey: BotConfigKey = botKeys[botIndex] ?? 'STEADY';
      const botName = BOT_NAMES[botIndex] ?? `bot${botIndex + 1}`;
      // 头像色循环：info / neon / warning / success
      const avatarColors: Array<Player['avatarColor']> = [
        'info',
        'neon',
        'warning',
        'success',
      ];
      players.push(
        buildPlayer({
          id: `p-bot-${botIndex + 1}`,
          type: 'bot',
          name: botName,
          avatarColor: avatarColors[botIndex % avatarColors.length],
          hand: hands[i],
          botConfigKey: botKey,
        }),
      );
      botIndex++;
    }
  }

  const state: GameState = {
    players,
    currentPlayerIndex: startingIdx,
    startingPlayerIndex: startingIdx,
    activeSet: null,
    activeSetOwnerIndex: null,
    lastShowerIndex: null,
    scoutedSinceLastShow: [],
    roundEndConditionTriggerer: null,
    roundEndCondition: null,
    round: 1,
    totalRounds: playerCount,
    phase: 'playing',
    seed,
    history: [],
    turnInRound: 0,
    hasActedThisRound: new Array(playerCount).fill(false),
  };

  return { state, rng };
}

/**
 * 开始下一轮：
 *   1. 先结算上一轮（加 totalScore）
 *   2. 起始玩家顺时针 +1
 *   3. 重置 Scout Chip / collected / hand（重新发牌）
 *   4. 注意：Scout & Show Chip 的官方规则是"每局每人 1 个"（非每轮），但实际在官方说明里有"Return each player's Scout & Show chips"的 Ending the Round 环节，说明每轮重置。我们按每轮重置处理，更符合常见玩法。
 *   5. phase 重置为 playing；round += 1
 */
export function startNextRound(state: GameState, rng: RNG): GameState {
  // 1. 先把上轮得分加到 totalScore
  const roundScores = computeRoundScores(state);
  const scored = applyRoundScoresToTotal(state, roundScores);

  // 2. 如果达到总轮数，整局结束
  if (scored.round >= scored.totalRounds) {
    return { ...scored, phase: 'gameEnd' };
  }

  // 3. 新一轮：重新发牌
  const playerCount = scored.players.length;
  const deck = generateDeck(playerCount);
  const shuffled = shuffleDeck(deck, rng);
  const hands = dealCards(shuffled, playerCount);

  // 4. 起始玩家顺时针 +1
  const newStartingIdx = (scored.startingPlayerIndex + 1) % playerCount;

  const nextState: GameState = {
    ...scored,
    players: scored.players.map((p, i) => ({
      ...p,
      hand: hands[i],
      collectedCards: [],
      scoutChips: 0,
      scoutShowChipUsed: false, // 每轮重置（按官方"Ending the Round"条目）
      // totalScore 保留（跨轮累加）
    })),
    currentPlayerIndex: newStartingIdx,
    startingPlayerIndex: newStartingIdx,
    activeSet: null,
    activeSetOwnerIndex: null,
    lastShowerIndex: null,
    scoutedSinceLastShow: [],
    roundEndConditionTriggerer: null,
    roundEndCondition: null,
    round: scored.round + 1,
    phase: 'playing',
    // seed 保留（同一局；若想每轮独立可用 seed + round 组合）
    history: [],
    turnInRound: 0,
    hasActedThisRound: new Array(playerCount).fill(false),
  };
  return nextState;
}

// ========== 辅助 ==========

interface BuildPlayerInput {
  id: string;
  type: Player['type'];
  name: string;
  avatarColor: string;
  hand: Card[];
  botConfigKey?: BotConfigKey;
}

function buildPlayer(input: BuildPlayerInput): Player {
  return {
    id: input.id,
    type: input.type,
    name: input.name,
    avatarColor: input.avatarColor,
    hand: input.hand,
    collectedCards: [],
    scoutChips: 0,
    scoutShowChipUsed: false,
    totalScore: 0,
    botConfigKey: input.botConfigKey,
  };
}

/** 判断本局是否结束（所有轮已打完） */
export function isGameOver(state: GameState): boolean {
  return state.phase === 'gameEnd';
}

/**
 * 生成一个已结算完 roundEnd 的 state（手动推进到 gameEnd 或下一轮的前一步）
 * 工具方法：供 store / 测试使用
 */
export function finalizeRoundIfNeeded(state: GameState): { scores: ReturnType<typeof computeRoundScores> } | null {
  if (state.phase !== 'roundEnd') return null;
  return { scores: computeRoundScores(state) };
}

// 给存量使用者保留一个 rebuildRngFromSeed 便利函数
export function rebuildRng(seed: string): RNG {
  return createRNG(seed);
}
