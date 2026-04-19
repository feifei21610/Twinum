/**
 * 规则引擎单测：合法牌组 + 强弱比较
 * 严格对齐 scout/docs/03-game-rules.md
 */
import { describe, expect, it } from 'vitest';
import type { Card } from '../../src/types/game';
import {
  canBeat,
  compareGroups,
  tryBuildGroup,
  tryBuildGroupFromHand,
} from '../../src/game-engine/rules';

// 测试辅助：用数字构造 Card（top 朝上，bottom 暂用 top+10 占位，不影响测试）
function c(value: number, bottom: number = value + 10): Card {
  return { id: `c-${value}-${bottom}`, top: value, bottom, flipped: false };
}

describe('tryBuildGroup - 合法牌组识别', () => {
  it('单张牌：任意一张都合法（same 长度 1）', () => {
    const g = tryBuildGroup([c(7)]);
    expect(g).not.toBeNull();
    expect(g!.kind).toBe('same');
    expect(g!.minValue).toBe(7);
    expect(g!.cards).toHaveLength(1);
  });

  it('相同数字组 - 合法', () => {
    const g = tryBuildGroup([c(5), c(5), c(5)]);
    expect(g).not.toBeNull();
    expect(g!.kind).toBe('same');
    expect(g!.minValue).toBe(5);
  });

  it('连续数字组 - 升序合法', () => {
    const g = tryBuildGroup([c(3), c(4), c(5)]);
    expect(g).not.toBeNull();
    expect(g!.kind).toBe('run');
    expect(g!.minValue).toBe(3);
  });

  it('连续数字组 - 降序合法', () => {
    const g = tryBuildGroup([c(5), c(4), c(3)]);
    expect(g).not.toBeNull();
    expect(g!.kind).toBe('run');
    expect(g!.minValue).toBe(3);
  });

  it('非连续数字 - 不合法', () => {
    const g = tryBuildGroup([c(3), c(5), c(7)]);
    expect(g).toBeNull();
  });

  it('先升后降 - 不合法（2,3,2）', () => {
    const g = tryBuildGroup([c(2), c(3), c(2)]);
    expect(g).toBeNull();
  });

  it('跨越重复数字 - 不合法（3,4,4）', () => {
    const g = tryBuildGroup([c(3), c(4), c(4)]);
    expect(g).toBeNull();
  });

  it('考虑翻面数字（flipped=true 用 bottom）', () => {
    const card: Card = { id: 'x', top: 10, bottom: 3, flipped: true };
    const g = tryBuildGroup([card]);
    expect(g!.minValue).toBe(3); // 朝上是 bottom
  });
});

describe('tryBuildGroupFromHand - 从手牌索引构建', () => {
  const hand = [c(3), c(4), c(5), c(9), c(9), c(9)];

  it('连续 index 连续数字 → 合法', () => {
    const g = tryBuildGroupFromHand(hand, [0, 1, 2]);
    expect(g).not.toBeNull();
    expect(g!.kind).toBe('run');
  });

  it('连续 index 相同数字 → 合法', () => {
    const g = tryBuildGroupFromHand(hand, [3, 4, 5]);
    expect(g).not.toBeNull();
    expect(g!.kind).toBe('same');
    expect(g!.minValue).toBe(9);
  });

  it('非相邻 index → 不合法', () => {
    const g = tryBuildGroupFromHand(hand, [0, 2, 3]);
    expect(g).toBeNull();
  });

  it('乱序 index → 不合法（必须单调递增且相邻）', () => {
    const g = tryBuildGroupFromHand(hand, [1, 0, 2]);
    expect(g).toBeNull();
  });

  it('index 越界 → 不合法', () => {
    const g = tryBuildGroupFromHand(hand, [4, 5, 6]);
    expect(g).toBeNull();
  });
});

describe('compareGroups / canBeat - 强弱比较', () => {
  it('① 张数：多的强', () => {
    const a = tryBuildGroup([c(9), c(9)])!; // 2 张 9
    const b = tryBuildGroup([c(1), c(2), c(3)])!; // 3 张 1-3
    expect(compareGroups(b, a)).toBeGreaterThan(0);
    expect(canBeat(b, a)).toBe(true);
    expect(canBeat(a, b)).toBe(false);
  });

  it('② 同张数：same > run', () => {
    const a = tryBuildGroup([c(9), c(8)])!; // 连续
    const b = tryBuildGroup([c(2), c(2)])!; // 相同
    expect(compareGroups(b, a)).toBeGreaterThan(0);
    expect(canBeat(b, a)).toBe(true);
  });

  it('③ 同张数同类型：最小数字大的强', () => {
    const a = tryBuildGroup([c(3), c(4), c(5)])!; // min=3
    const b = tryBuildGroup([c(4), c(5), c(6)])!; // min=4
    expect(compareGroups(b, a)).toBeGreaterThan(0);
    expect(canBeat(b, a)).toBe(true);
  });

  it('完全相同 → 不能盖过', () => {
    const a = tryBuildGroup([c(5), c(6)])!;
    const b = tryBuildGroup([c(5), c(6)])!;
    expect(compareGroups(b, a)).toBe(0);
    expect(canBeat(b, a)).toBe(false);
  });

  it('场上无牌 → 任意合法组都能出', () => {
    const x = tryBuildGroup([c(1)])!;
    expect(canBeat(x, null)).toBe(true);
  });

  it('边界：同张数 run vs same（same 更强，即使 minValue 更小）', () => {
    const runBig = tryBuildGroup([c(8), c(9), c(10)])!; // run, min=8
    const sameSmall = tryBuildGroup([c(2), c(2), c(2)])!; // same, min=2
    expect(compareGroups(sameSmall, runBig)).toBeGreaterThan(0); // same 赢
  });
});
