/**
 * 计分模块
 * 严格对齐 scout/docs/03-game-rules.md "每轮计分"
 *
 * 本轮得分 = 已收集牌数 + Scout Chip 数 − 剩余手牌数
 * 例外：触发条件 ii 的玩家不扣手牌分（视为 0）
 * Active Set 和 Scout&Show Chip 都不计分
 */
import type { GameState } from '../types/game';

export interface RoundScore {
  playerIndex: number;
  collectedPoints: number; // 已收集的翻面牌数
  scoutChipPoints: number; // Scout Chip 数（等值于分数）
  handPenalty: number; // 剩余手牌扣分（正数表示扣多少）
  total: number; // 本轮总分（可能为负）
}

/**
 * 计算某一轮结束时每位玩家的得分
 */
export function computeRoundScores(state: GameState): RoundScore[] {
  return state.players.map((p, idx) => {
    const collectedPoints = p.collectedCards.length;
    const scoutChipPoints = p.scoutChips;
    // 条件 ii 触发者不扣手牌
    const isConditionIiTriggerer =
      state.roundEndCondition === 'ii' && state.roundEndConditionTriggerer === idx;
    const handPenalty = isConditionIiTriggerer ? 0 : p.hand.length;
    return {
      playerIndex: idx,
      collectedPoints,
      scoutChipPoints,
      handPenalty,
      total: collectedPoints + scoutChipPoints - handPenalty,
    };
  });
}

/**
 * 将本轮得分累加到玩家 totalScore（返回新 state，不修改原）
 */
export function applyRoundScoresToTotal(state: GameState, scores: RoundScore[]): GameState {
  const next = structuredClone(state);
  for (const s of scores) {
    next.players[s.playerIndex].totalScore += s.total;
  }
  return next;
}

/**
 * 整局结束时计算胜者（可能多个，平局共享）
 * @returns 获胜玩家 index 列表；按总分降序，平分并列
 */
export function computeWinners(state: GameState): number[] {
  const maxScore = Math.max(...state.players.map((p) => p.totalScore));
  return state.players
    .map((p, i) => ({ i, s: p.totalScore }))
    .filter((x) => x.s === maxScore)
    .map((x) => x.i);
}
