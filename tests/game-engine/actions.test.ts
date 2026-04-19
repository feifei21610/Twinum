/**
 * actions.ts 单测：状态转移
 * 覆盖：Show / Scout / ScoutAndShow / FlipHand / 条件 i / 条件 ii
 */
import { describe, expect, it } from 'vitest';
import type { Card, GameState, Player } from '../../src/types/game';
import {
  applyFlipHand,
  applyScout,
  applyScoutAndShow,
  applyShow,
  hasFlippedHandThisRound,
} from '../../src/game-engine/actions';

function c(value: number, id?: string): Card {
  return { id: id ?? `c-${value}-${Math.random()}`, top: value, bottom: value + 10, flipped: false };
}

function mkPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: overrides.id ?? 'p',
    type: overrides.type ?? 'human',
    name: overrides.name ?? 'P',
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
    phase: 'playing',
    seed: 'test',
    history: [],
    turnInRound: 0,
    hasActedThisRound: new Array(players.length).fill(false),
    ...patch,
  };
}

describe('applyShow', () => {
  it('场上无牌时 - 出一张合法单牌', () => {
    const s = mkState([
      mkPlayer({ id: 'a', hand: [c(5), c(7), c(9)] }),
      mkPlayer({ id: 'b', hand: [c(1), c(2), c(3)] }),
      mkPlayer({ id: 'c', hand: [c(4), c(6), c(8)] }),
    ]);
    const next = applyShow(s, [0]);
    expect(next).not.toBeNull();
    expect(next!.activeSet!.minValue).toBe(5);
    expect(next!.activeSetOwnerIndex).toBe(0);
    expect(next!.players[0].hand).toHaveLength(2);
    expect(next!.currentPlayerIndex).toBe(1); // 流转到下家
    expect(next!.hasActedThisRound[0]).toBe(true);
  });

  it('出牌后原 active set 翻面进入玩家 collectedCards', () => {
    const s = mkState(
      [
        mkPlayer({ id: 'a', hand: [c(9), c(9)] }),
        mkPlayer({ id: 'b', hand: [c(1)] }),
        mkPlayer({ id: 'c', hand: [c(1)] }),
      ],
      {
        activeSet: {
          kind: 'run',
          cards: [c(3), c(4)],
          minValue: 3,
        },
        activeSetOwnerIndex: 1, // B 是 owner
      },
    );
    const next = applyShow(s, [0, 1]); // A 出 [9,9] 盖过 [3,4]
    expect(next).not.toBeNull();
    expect(next!.players[0].collectedCards).toHaveLength(2); // A 收集了原 active set 的 2 张
    expect(next!.players[0].collectedCards.every((card) => card.flipped)).toBe(true); // 翻面了
    expect(next!.activeSet!.cards).toHaveLength(2);
    expect(next!.activeSet!.minValue).toBe(9);
    expect(next!.activeSetOwnerIndex).toBe(0);
  });

  it('不合法的 Show - 返回 null', () => {
    const s = mkState([
      mkPlayer({ id: 'a', hand: [c(5), c(7)] }),
      mkPlayer({ id: 'b' }),
      mkPlayer({ id: 'c' }),
    ]);
    const next = applyShow(s, [0, 1]); // 5,7 不相同也不连续
    expect(next).toBeNull();
  });

  it('出光手牌 → 触发条件 i（回合结束）', () => {
    const s = mkState([
      mkPlayer({ id: 'a', hand: [c(9)] }),
      mkPlayer({ id: 'b' }),
      mkPlayer({ id: 'c' }),
    ]);
    const next = applyShow(s, [0]);
    expect(next!.phase).toBe('roundEnd');
    expect(next!.roundEndCondition).toBe('i');
    expect(next!.roundEndConditionTriggerer).toBe(0);
  });
});

describe('applyScout', () => {
  it('从左端 Scout 1 张 + owner 得 1 Chip', () => {
    const s = mkState(
      [
        mkPlayer({ id: 'a', hand: [c(1)] }),
        mkPlayer({ id: 'b', hand: [c(5)] }),
        mkPlayer({ id: 'c', hand: [c(8)] }),
      ],
      {
        currentPlayerIndex: 0,
        activeSet: {
          kind: 'run',
          cards: [c(3), c(4), c(5)],
          minValue: 3,
        },
        activeSetOwnerIndex: 1,
      },
    );
    const next = applyScout(s, { from: 'left', flip: false, insertAt: 0 });
    expect(next).not.toBeNull();
    expect(next!.players[0].hand).toHaveLength(2); // 手牌多了 1 张
    expect(next!.players[0].hand[0].top).toBe(3); // 从左端抽到 3
    expect(next!.players[1].scoutChips).toBe(1); // owner 得 1 Chip
    expect(next!.activeSet!.cards).toHaveLength(2); // active 少 1
    expect(next!.currentPlayerIndex).toBe(1);
  });

  it('Scout 翻面后插入手牌', () => {
    const s = mkState(
      [
        mkPlayer({ id: 'a', hand: [c(1)] }),
        mkPlayer({ id: 'b' }),
        mkPlayer({ id: 'c' }),
      ],
      {
        activeSet: {
          kind: 'same',
          cards: [{ id: 'x', top: 7, bottom: 3, flipped: false }],
          minValue: 7,
        },
        activeSetOwnerIndex: 1,
      },
    );
    const next = applyScout(s, { from: 'left', flip: true, insertAt: 1 });
    expect(next!.players[0].hand).toHaveLength(2);
    expect(next!.players[0].hand[1].flipped).toBe(true); // 插入的牌被翻了
    expect(next!.activeSet).toBeNull(); // active 被抽空
    expect(next!.activeSetOwnerIndex).toBeNull();
  });

  it('不能 Scout 自己的牌', () => {
    const s = mkState(
      [
        mkPlayer({ id: 'a', hand: [c(1)] }),
        mkPlayer({ id: 'b' }),
        mkPlayer({ id: 'c' }),
      ],
      {
        activeSet: {
          kind: 'same',
          cards: [c(7)],
          minValue: 7,
        },
        activeSetOwnerIndex: 0, // A 自己的
      },
    );
    const next = applyScout(s, { from: 'left', flip: false, insertAt: 0 });
    expect(next).toBeNull();
  });

  it('条件 ii：Show 后其他所有玩家都 Scout → 回合结束', () => {
    // 3 人局：A 先 Show，然后 B Scout，C Scout → 回到 A → 条件 ii 触发
    // 注意：A 需要 Show 后还有手牌剩余（否则会直接触发条件 i）
    const s0 = mkState(
      [
        mkPlayer({ id: 'a', hand: [c(9), c(9), c(1), c(2)] }), // 留 2 张剩余
        mkPlayer({ id: 'b', hand: [c(3), c(4)] }),
        mkPlayer({ id: 'c', hand: [c(5), c(6)] }),
      ],
      { currentPlayerIndex: 0 },
    );
    // A 出 [9, 9] 建立 active set，手牌还剩 [1, 2]
    const s1 = applyShow(s0, [0, 1])!;
    expect(s1.currentPlayerIndex).toBe(1);
    expect(s1.lastShowerIndex).toBe(0);
    expect(s1.phase).toBe('playing'); // 还没结束
    // B Scout
    const s2 = applyScout(s1, { from: 'left', flip: false, insertAt: 0 })!;
    expect(s2.currentPlayerIndex).toBe(2);
    expect(s2.phase).toBe('playing');
    // C Scout → 其他两人（B/C）都 Scout 了，回合结束条件 ii 触发
    const s3 = applyScout(s2, { from: 'left', flip: false, insertAt: 0 })!;
    expect(s3.phase).toBe('roundEnd');
    expect(s3.roundEndCondition).toBe('ii');
    expect(s3.roundEndConditionTriggerer).toBe(0); // A
  });
});

describe('applyScoutAndShow', () => {
  it('消耗 Chip，依次执行 Scout + Show', () => {
    const s = mkState(
      [
        mkPlayer({ id: 'a', hand: [c(9)] }),
        mkPlayer({ id: 'b' }),
        mkPlayer({ id: 'c' }),
      ],
      {
        currentPlayerIndex: 0,
        activeSet: {
          kind: 'run',
          cards: [c(5), c(6)],
          minValue: 5,
        },
        activeSetOwnerIndex: 1,
      },
    );
    // 从左端 Scout 一张 5，插到位置 0，再 Show [0,1]（应为 [5,9]？不，5 和 9 不连续也不相同）
    // 改用：从右端 Scout 8？active set 是 [5,6]。
    // 我们调整：从左端 Scout，取到 5，翻面后是 15（不合法的数字）。不翻面则是 5，和 9 不构成合法。
    // 改为 Show [0] 单张即可（单张总是合法，minValue=5，比场上 active=[6]（剩下 1 张，minValue=6）小）。
    // 更简单的场景：active 只剩 1 张 → 抽完后 activeSet=null，Show 任意单张合法。
    const s2: GameState = {
      ...s,
      activeSet: { kind: 'same', cards: [c(5)], minValue: 5 },
    };
    const next = applyScoutAndShow(s2, {
      scout: { from: 'left', flip: false, insertAt: 0 },
      show: [0], // Scout 后 hand = [5, 9]，Show [0] 即单张 5
    });
    expect(next).not.toBeNull();
    expect(next!.players[0].scoutShowChipUsed).toBe(true);
    expect(next!.players[0].hand).toHaveLength(1); // Scout 加 1、Show 减 1，手牌数等同开始
    expect(next!.history).toHaveLength(1); // 合并为一条 SCOUT_AND_SHOW
    expect(next!.history[0].type).toBe('SCOUT_AND_SHOW');
  });

  it('Chip 已用 - 不能再 Scout&Show', () => {
    const s = mkState(
      [
        mkPlayer({ id: 'a', hand: [c(1)], scoutShowChipUsed: true }),
        mkPlayer({ id: 'b' }),
        mkPlayer({ id: 'c' }),
      ],
      {
        activeSet: { kind: 'same', cards: [c(5)], minValue: 5 },
        activeSetOwnerIndex: 1,
      },
    );
    const next = applyScoutAndShow(s, {
      scout: { from: 'left', flip: false, insertAt: 0 },
      show: [0],
    });
    expect(next).toBeNull();
  });
});

describe('applyFlipHand', () => {
  it('整副翻转（top ↔ bottom）', () => {
    const s = mkState([
      mkPlayer({ id: 'a', hand: [c(3, 'x'), c(5, 'y')] }),
      mkPlayer({ id: 'b' }),
      mkPlayer({ id: 'c' }),
    ]);
    const next = applyFlipHand(s);
    expect(next).not.toBeNull();
    expect(next!.players[0].hand.every((card) => card.flipped)).toBe(true);
    expect(hasFlippedHandThisRound(next!)).toBe(true);
  });

  it('已经做过动作 - 不能翻', () => {
    const s = mkState(
      [
        mkPlayer({ id: 'a', hand: [c(3)] }),
        mkPlayer({ id: 'b' }),
        mkPlayer({ id: 'c' }),
      ],
      { hasActedThisRound: [true, false, false] },
    );
    const next = applyFlipHand(s);
    expect(next).toBeNull();
  });
});
