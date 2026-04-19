/**
 * 发牌/RNG/回合流转 单测
 */
import { describe, expect, it } from 'vitest';
import { createRNG, generateSeed, shuffle } from '../../src/game-engine/rng';
import {
  dealCards,
  findStartingPlayerIndex,
  generateDeck,
  shuffleDeck,
} from '../../src/game-engine/deck';
import { startNewGame, startNextRound } from '../../src/game-engine/round';

describe('RNG - 可复现性', () => {
  it('同 seed 同结果', () => {
    const r1 = createRNG('abc');
    const r2 = createRNG('abc');
    const s1 = [r1.next(), r1.next(), r1.next()];
    const s2 = [r2.next(), r2.next(), r2.next()];
    expect(s1).toEqual(s2);
  });

  it('不同 seed 不同结果（极大概率）', () => {
    const r1 = createRNG('abc');
    const r2 = createRNG('xyz');
    expect(r1.next()).not.toBe(r2.next());
  });

  it('shuffle 同 seed 同结果', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7];
    const s1 = shuffle(arr, createRNG('same'));
    const s2 = shuffle(arr, createRNG('same'));
    expect(s1).toEqual(s2);
  });

  it('generateSeed 每次不同', () => {
    const a = generateSeed();
    const b = generateSeed();
    expect(a).not.toBe(b);
  });
});

describe('generateDeck - 按玩家数（官方规则）', () => {
  it('3 人局 → 36 张（移除全部 9 张含 10 的牌）', () => {
    expect(generateDeck(3)).toHaveLength(36);
  });

  it('4 人局 → 44 张（移除 [9,10] 那 1 张）', () => {
    expect(generateDeck(4)).toHaveLength(44);
  });

  it('5 人局 → 45 张（不移除）', () => {
    expect(generateDeck(5)).toHaveLength(45);
  });

  it('3 人局移除后不含任何标 10 的牌', () => {
    const d = generateDeck(3);
    expect(d.some((c) => c.top === 10 || c.bottom === 10)).toBe(false);
  });

  it('4 人局仅移除 [9,10] 那张（仍有其他 10×N 的牌）', () => {
    const d = generateDeck(4);
    // 不包含 [10,9] 那张
    expect(
      d.some((c) => (c.top === 10 && c.bottom === 9) || (c.top === 9 && c.bottom === 10)),
    ).toBe(false);
    // 但包含其他含 10 的牌（如 [10,8]）
    expect(d.some((c) => c.top === 10 || c.bottom === 10)).toBe(true);
  });

  it('3 人局：每人发 12 张正好用完（3×12=36）', () => {
    // 通过数学验证：总牌数刚好等于 3 × 12
    expect(generateDeck(3).length).toBe(3 * 12);
  });
});

describe('shuffleDeck - 洗牌 + 随机翻面', () => {
  it('洗牌后张数不变', () => {
    const d = generateDeck(3);
    const s = shuffleDeck(d, createRNG('x'));
    expect(s).toHaveLength(d.length);
  });

  it('洗牌后有翻面与不翻面的牌（概率性，不会全一致）', () => {
    const d = generateDeck(3);
    const s = shuffleDeck(d, createRNG('shuffle-test'));
    const flippedCount = s.filter((c) => c.flipped).length;
    // 44 张随机翻面，不太可能全部翻面或全部不翻面
    expect(flippedCount).toBeGreaterThan(0);
    expect(flippedCount).toBeLessThan(d.length);
  });
});

describe('dealCards - 发牌', () => {
  it('3 人局每人 12 张', () => {
    const d = generateDeck(3);
    const s = shuffleDeck(d, createRNG('x'));
    const hands = dealCards(s, 3);
    expect(hands).toHaveLength(3);
    hands.forEach((h) => expect(h).toHaveLength(12));
    // 36 张 = 3 × 12，剩下 8 张不发（36+8=44 ✅）
  });

  it('各玩家手牌无重复', () => {
    const d = generateDeck(3);
    const s = shuffleDeck(d, createRNG('x'));
    const hands = dealCards(s, 3);
    const allIds = hands.flatMap((h) => h.map((c) => c.id));
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});

describe('findStartingPlayerIndex', () => {
  it('找到持有 [1,2] 那张牌的玩家（不管朝向）', () => {
    const d = generateDeck(3);
    const s = shuffleDeck(d, createRNG('start-test'));
    const hands = dealCards(s, 3);
    const idx = findStartingPlayerIndex(hands);
    const startHand = hands[idx];
    expect(
      startHand.some(
        (c) => (c.top === 1 && c.bottom === 2) || (c.top === 2 && c.bottom === 1),
      ),
    ).toBe(true);
  });
});

describe('startNewGame', () => {
  it('初始化 3 人局：1 人类 + 2 Bot，每人 12 张', () => {
    const { state } = startNewGame({ seed: 'new-game', playerCount: 3 });
    expect(state.players).toHaveLength(3);
    expect(state.players[0].type).toBe('human');
    expect(state.players[1].type).toBe('bot');
    expect(state.players[2].type).toBe('bot');
    expect(state.players[1].name).toBe('bot1');
    expect(state.players[2].name).toBe('bot2');
    state.players.forEach((p) => expect(p.hand).toHaveLength(12));
    expect(state.phase).toBe('playing');
    expect(state.round).toBe(1);
    expect(state.totalRounds).toBe(3);
  });

  it('初始化 4 人局（MVP 默认）：1 人类 + 3 Bot，每人 11 张，4 轮', () => {
    const { state } = startNewGame({ seed: 'four-player' });
    expect(state.players).toHaveLength(4);
    expect(state.players[0].type).toBe('human');
    expect(state.players[1].name).toBe('bot1');
    expect(state.players[2].name).toBe('bot2');
    expect(state.players[3].name).toBe('bot3');
    state.players.forEach((p) => expect(p.hand).toHaveLength(11));
    expect(state.totalRounds).toBe(4);
  });

  it('allBots=true：所有玩家都是 Bot（用于测试/模拟）', () => {
    const { state } = startNewGame({
      seed: 'all-bots',
      playerCount: 4,
      allBots: true,
    });
    expect(state.players).toHaveLength(4);
    state.players.forEach((p) => expect(p.type).toBe('bot'));
    expect(state.players.map((p) => p.name)).toEqual(['bot1', 'bot2', 'bot3', 'bot4']);
  });

  it('同 seed 同牌局（可复现）', () => {
    const a = startNewGame({ seed: 'repro', playerCount: 3 });
    const b = startNewGame({ seed: 'repro', playerCount: 3 });
    for (let i = 0; i < 3; i++) {
      expect(a.state.players[i].hand.map((c) => c.id)).toEqual(
        b.state.players[i].hand.map((c) => c.id),
      );
    }
  });
});

describe('startNextRound', () => {
  it('轮末结算 → 进入新一轮，起始玩家 +1', () => {
    const { state, rng } = startNewGame({ seed: 'r', playerCount: 3 });
    // 模拟：把 state 设为 roundEnd
    const roundEndState = {
      ...state,
      phase: 'roundEnd' as const,
      roundEndCondition: 'i' as const,
      roundEndConditionTriggerer: 0,
      players: state.players.map((p) => ({
        ...p,
        collectedCards: [p.hand[0]], // 收集 1 张（+1）
        hand: p.hand.slice(1), // 剩 11 张（-11）
        scoutChips: 1, // (+1)
      })),
    };

    const next = startNextRound(roundEndState, rng);
    expect(next.round).toBe(2);
    expect(next.phase).toBe('playing');
    expect(next.startingPlayerIndex).toBe((state.startingPlayerIndex + 1) % 3);
    // totalScore 被累加
    next.players.forEach((p) => {
      // 每人得分 1 + 1 − 11 = -9，除非是条件 i 触发者也一样扣
      expect(p.totalScore).toBe(-9);
    });
    // 手牌被重发
    next.players.forEach((p) => expect(p.hand).toHaveLength(12));
    // Chip 重置
    next.players.forEach((p) => {
      expect(p.scoutChips).toBe(0);
      expect(p.scoutShowChipUsed).toBe(false);
    });
  });

  it('第 3 轮结束后 → phase=gameEnd', () => {
    const { state, rng } = startNewGame({ seed: 'final', playerCount: 3 });
    const roundEndState = {
      ...state,
      round: 3, // 已经是最后一轮
      phase: 'roundEnd' as const,
      roundEndCondition: 'i' as const,
      roundEndConditionTriggerer: 0,
    };
    const next = startNextRound(roundEndState, rng);
    expect(next.phase).toBe('gameEnd');
  });
});
