/**
 * scoring.ts 单测：计分公式
 * 严格对齐 scout/docs/03-game-rules.md "每轮计分"
 */
import { describe, expect, it } from 'vitest';
import type { Card, GameState, Player } from '../../src/types/game';
import {
  applyRoundScoresToTotal,
  computeRoundScores,
  computeWinners,
} from '../../src/game-engine/scoring';

function c(value: number): Card {
  return { id: `c-${value}`, top: value, bottom: value + 10, flipped: false };
}
function mkPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p',
    type: 'human',
    name: 'P',
    avatarColor: 'primary',
    hand: [],
    collectedCards: [],
    scoutChips: 0,
    scoutShowChipUsed: false,
    totalScore: 0,
    ...overrides,
  };
}
function mkState(players: Player[], patch: Partial<GameState> = {}): GameState {
  return {
    players,
    currentPlayerIndex: 0,
    startingPlayerIndex: 0,
    activeSet: null,
    activeSetOwnerIndex: null,
    lastShowerIndex: null,
    scoutedSinceLastShow: [],
    roundEndConditionTriggerer: null,
    roundEndCondition: null,
    round: 1,
    totalRounds: 3,
    phase: 'roundEnd',
    seed: 'test',
    history: [],
    turnInRound: 0,
    hasActedThisRound: [false, false, false],
    ...patch,
  };
}

describe('computeRoundScores - 计分公式', () => {
  it('得分 = 收集牌数 + Scout Chip − 剩余手牌', () => {
    const s = mkState(
      [
        mkPlayer({
          collectedCards: [c(1), c(2), c(3)], // +3
          scoutChips: 2, // +2
          hand: [c(9)], // -1
        }),
        mkPlayer({ hand: [c(5)] }),
        mkPlayer({ hand: [c(6)] }),
      ],
      { roundEndCondition: 'i', roundEndConditionTriggerer: 1 },
    );
    const scores = computeRoundScores(s);
    expect(scores[0]).toEqual({
      playerIndex: 0,
      collectedPoints: 3,
      scoutChipPoints: 2,
      handPenalty: 1,
      total: 4, // 3 + 2 - 1
    });
  });

  it('条件 ii 触发者：不扣手牌分', () => {
    const s = mkState(
      [
        mkPlayer({
          collectedCards: [c(1)], // +1
          scoutChips: 0,
          hand: [c(9), c(9), c(9)], // 正常扣 3，但因为是触发者 → 0
        }),
        mkPlayer({ hand: [c(5)] }),
        mkPlayer({ hand: [c(6)] }),
      ],
      { roundEndCondition: 'ii', roundEndConditionTriggerer: 0 },
    );
    const scores = computeRoundScores(s);
    expect(scores[0].handPenalty).toBe(0);
    expect(scores[0].total).toBe(1); // 1 + 0 - 0
    // 其他玩家正常扣
    expect(scores[1].handPenalty).toBe(1);
    expect(scores[2].handPenalty).toBe(1);
  });

  it('条件 i 触发者：也扣手牌分（官方：只有条件 ii 触发者免扣）', () => {
    const s = mkState(
      [
        mkPlayer({ collectedCards: [c(1)], hand: [] }), // 出光的人 hand 本来就是 0
        mkPlayer({ hand: [c(2), c(3)] }),
        mkPlayer({ hand: [c(4)] }),
      ],
      { roundEndCondition: 'i', roundEndConditionTriggerer: 0 },
    );
    const scores = computeRoundScores(s);
    expect(scores[0].total).toBe(1); // 1 + 0 - 0（手牌本来 0）
    expect(scores[1].handPenalty).toBe(2); // 即使是条件 i，其他人也要扣
    expect(scores[2].handPenalty).toBe(1);
  });

  it('Active Set 和 Scout&Show Chip 不计分', () => {
    const s = mkState(
      [
        mkPlayer({
          collectedCards: [c(1), c(2)], // +2
          scoutChips: 1, // +1
          scoutShowChipUsed: false, // 没用，但不算分
          hand: [c(9)], // -1
        }),
        mkPlayer({ hand: [] }),
        mkPlayer({ hand: [] }),
      ],
      {
        // 即使有 active set，也不进入任何人的得分
        activeSet: { kind: 'same', cards: [c(5), c(5)], minValue: 5 },
        activeSetOwnerIndex: 0,
        roundEndCondition: 'i',
      },
    );
    const scores = computeRoundScores(s);
    expect(scores[0].total).toBe(2 + 1 - 1); // active set 的 2 张没算进去
  });
});

describe('applyRoundScoresToTotal', () => {
  it('本轮得分累加到 totalScore', () => {
    const s = mkState([
      mkPlayer({ totalScore: 10 }),
      mkPlayer({ totalScore: 5 }),
      mkPlayer({ totalScore: 0 }),
    ]);
    const scores = [
      { playerIndex: 0, collectedPoints: 0, scoutChipPoints: 0, handPenalty: 0, total: 3 },
      { playerIndex: 1, collectedPoints: 0, scoutChipPoints: 0, handPenalty: 0, total: -2 },
      { playerIndex: 2, collectedPoints: 0, scoutChipPoints: 0, handPenalty: 0, total: 7 },
    ];
    const next = applyRoundScoresToTotal(s, scores);
    expect(next.players[0].totalScore).toBe(13);
    expect(next.players[1].totalScore).toBe(3);
    expect(next.players[2].totalScore).toBe(7);
  });
});

describe('computeWinners', () => {
  it('单一胜者', () => {
    const s = mkState([
      mkPlayer({ totalScore: 10 }),
      mkPlayer({ totalScore: 7 }),
      mkPlayer({ totalScore: 5 }),
    ]);
    expect(computeWinners(s)).toEqual([0]);
  });

  it('平局共享胜利', () => {
    const s = mkState([
      mkPlayer({ totalScore: 8 }),
      mkPlayer({ totalScore: 8 }),
      mkPlayer({ totalScore: 5 }),
    ]);
    expect(computeWinners(s)).toEqual([0, 1]);
  });
});
