/**
 * 手牌分组算法（Bot v2 规划驱动版）
 *
 * 每次决策前，对当前手牌做一次"最优分组快照"。分组结果驱动 4 级决策优先级。
 *
 * 详见 scout/docs/06-bot-behavior.md 和 bot-v2-spec.md。
 */
import type { Card, CardGroupKind } from '../types/game';
import { faceValue } from '../types/game';
import { tryBuildGroup } from '../game-engine/rules';

// ========== 类型 ==========

export interface ComboInfo {
  /** 该组在手牌中的 index 区间 [start, end] */
  startIndex: number;
  endIndex: number;
  /** 该组所有牌的手牌 index 列表 */
  indexes: number[];
  kind: CardGroupKind;
  length: number;
  minValue: number;
  /** 战斗力：length × 30 + (same ? 12 : 0) + minValue */
  combatPower: number;
}

export interface LatentCombo {
  /** 左端牌的手牌 index */
  leftIndex: number;
  /** 右端牌的手牌 index（= leftIndex + 2） */
  rightIndex: number;
  /** 中间阻隔物的手牌 index（= leftIndex + 1） */
  blockerIndex: number;
  /** 若阻隔物消失后形成的组类型 */
  potentialKind: CardGroupKind;
  potentialMinValue: number;
}

export interface HandPartition {
  /** 已成连排（长度 ≥2 的合法组） */
  combos: ComboInfo[];
  /** 潜在连排（隔 1 张、两端能组） */
  latentCombos: LatentCombo[];
  /** 真孤牌的手牌 index */
  orphans: number[];
  /** 总战斗力（所有已成连排之和） */
  totalCombatPower: number;
  /** 孤牌数 */
  orphanCount: number;
}

// ========== 战斗力公式 ==========

/**
 * 单组战斗力
 *
 * 设计原则：length 权重（×30）必须大于同 len 下 same+minValue 的最大加成（12+10=22），
 * 确保"张数多"的绝对优先级不被 kind/minValue 翻盘。
 *
 * 官方规则对齐验证：
 *   [6,7,8] run 3  → 96（防御门槛）
 *   [1,1] same 2   → 73 > [9,10] run 2 (69)  ✅ 同 len same > run
 *   [10,10] same 2 → 82 < [1,2,3] run 3 (91) ✅ 张数优先
 *   [1,1,1] same 3 → 103 > [7,8,9] run 3 (97) ✅
 */
export function combatPower(length: number, kind: CardGroupKind, minValue: number): number {
  return length * 30 + (kind === 'same' ? 12 : 0) + minValue;
}

/** 防御组门槛（[6,7,8] 刚好达标） */
export const DEFENSE_THRESHOLD = 96;

// ========== 内部：枚举合法段 ==========

/**
 * 从 hand[start] 开始找所有能形成合法组的区间 [start, end]
 * 返回 { endIndex, kind, minValue } 的列表
 */
function findLegalSegmentsFrom(hand: Card[], start: number): Array<Omit<ComboInfo, 'indexes'>> {
  const results: Array<Omit<ComboInfo, 'indexes'>> = [];
  for (let end = start; end < hand.length; end++) {
    const cards = hand.slice(start, end + 1);
    if (cards.length === 1) continue; // 单张不算"已成连排"
    const group = tryBuildGroup(cards);
    if (!group) continue;
    results.push({
      startIndex: start,
      endIndex: end,
      kind: group.kind,
      length: cards.length,
      minValue: group.minValue,
      combatPower: combatPower(cards.length, group.kind, group.minValue),
    });
  }
  return results;
}

// ========== 核心：搜索最优分组 ==========

/**
 * 回溯搜索所有"把手牌切成若干段"的方式
 *
 * 每个位置可选：
 *   A. 作为孤牌（单张段）
 *   B. 与右邻若干张组成已成连排（必须是合法组）
 *
 * 全局最优：先孤牌数最少，再总战斗力最高
 */
function searchBestPartition(hand: Card[]): {
  combos: ComboInfo[];
  orphanIndexes: number[];
} {
  const n = hand.length;
  if (n === 0) return { combos: [], orphanIndexes: [] };

  interface BestState {
    combos: ComboInfo[];
    orphanIndexes: number[];
    orphanCount: number;
    totalPower: number;
    comboCount: number;
    hasDefenseCombo: boolean;
  }
  let best: BestState | null = null;

  const tryCombos: ComboInfo[] = [];
  const tryOrphans: number[] = [];

  function dfs(pos: number) {
    if (pos >= n) {
      const orphanCount = tryOrphans.length;
      const totalPower = tryCombos.reduce((s, c) => s + c.combatPower, 0);
      const comboCount = tryCombos.length;
      const hasDefenseCombo = tryCombos.some((c) => c.combatPower >= DEFENSE_THRESHOLD);
      // 优先级比较（严格字典序）：
      //   P1. 有防御组（至少一组 combatPower ≥ 96）
      //   P2. 孤牌最少
      //   P3. 组数最少（等价于"每组越长越好"）
      //   P4. 总战斗力最高
      //
      // 把"有防御"提到 P1 的原因：不能为了减少孤牌而把 [5,5,5] 这种防御组
      // 拆成 [5,5]+[5,X]。真人视角"留着大组做防御"优于"减少孤牌数"。
      let better = false;
      if (best === null) {
        better = true;
      } else if (hasDefenseCombo !== best.hasDefenseCombo) {
        better = hasDefenseCombo;
      } else if (orphanCount !== best.orphanCount) {
        better = orphanCount < best.orphanCount;
      } else if (comboCount !== best.comboCount) {
        better = comboCount < best.comboCount;
      } else {
        better = totalPower > best.totalPower;
      }
      if (better) {
        best = {
          combos: tryCombos.map((c) => ({ ...c, indexes: [...c.indexes] })),
          orphanIndexes: [...tryOrphans],
          orphanCount,
          totalPower,
          comboCount,
          hasDefenseCombo,
        };
      }
      return;
    }

    // 选项 A：pos 作为孤牌
    tryOrphans.push(pos);
    dfs(pos + 1);
    tryOrphans.pop();

    // 选项 B：从 pos 开始组成合法段
    const segments = findLegalSegmentsFrom(hand, pos);
    for (const seg of segments) {
      const indexes: number[] = [];
      for (let i = seg.startIndex; i <= seg.endIndex; i++) indexes.push(i);
      tryCombos.push({ ...seg, indexes });
      dfs(seg.endIndex + 1);
      tryCombos.pop();
    }
  }

  dfs(0);

  if (best === null) {
    // 理论不可达（至少 all-orphan 会被记录）
    return { combos: [], orphanIndexes: hand.map((_, i) => i) };
  }
  const finalBest = best as BestState;
  return {
    combos: finalBest.combos,
    orphanIndexes: finalBest.orphanIndexes,
  };
}

// ========== 潜在连排识别 ==========

/**
 * 对已经分好的"孤牌列表"识别"潜在连排"：
 *   两个孤牌 index 差恰好 2（中间隔 1 张，无论那张是否也是孤牌），
 *   且这两张的 faceValue 能组合（same 或 |diff|=1）
 *
 * 返回：
 *   - 被识别为潜在连排的两端会从 orphans 里移除
 *   - 中间那张牌（不管是不是孤牌）作为 blockerIndex 记录
 */
function identifyLatentCombos(
  hand: Card[],
  orphanIndexes: number[],
): { latentCombos: LatentCombo[]; remainingOrphans: number[] } {
  const sorted = [...orphanIndexes].sort((a, b) => a - b);
  const orphanSet = new Set(sorted);
  const used = new Set<number>();
  const latentCombos: LatentCombo[] = [];

  // 枚举所有孤牌对 (i, j) 其中 j - i = 2（两端是孤牌，中间牌可以是任何）
  for (const left of sorted) {
    if (used.has(left)) continue;
    const right = left + 2;
    if (!orphanSet.has(right) || used.has(right)) continue;

    const lv = faceValue(hand[left]);
    const rv = faceValue(hand[right]);
    let potentialKind: CardGroupKind | null = null;
    if (lv === rv) potentialKind = 'same';
    else if (Math.abs(lv - rv) === 1) potentialKind = 'run';
    if (!potentialKind) continue;

    latentCombos.push({
      leftIndex: left,
      rightIndex: right,
      blockerIndex: left + 1,
      potentialKind,
      potentialMinValue: Math.min(lv, rv),
    });
    used.add(left);
    used.add(right);
  }

  const remainingOrphans = sorted.filter((i) => !used.has(i));
  return { latentCombos, remainingOrphans };
}

// ========== 主入口 ==========

/**
 * 对手牌做最优分组
 */
export function partitionHand(hand: Card[]): HandPartition {
  const { combos, orphanIndexes } = searchBestPartition(hand);
  const { latentCombos, remainingOrphans } = identifyLatentCombos(hand, orphanIndexes);
  const totalCombatPower = combos.reduce((s, c) => s + c.combatPower, 0);
  return {
    combos,
    latentCombos,
    orphans: remainingOrphans,
    totalCombatPower,
    orphanCount: remainingOrphans.length,
  };
}

// ========== 工具函数 ==========

/**
 * 判断手牌是否有防御（至少一组 combatPower ≥ DEFENSE_THRESHOLD）
 */
export function hasDefense(hand: Card[]): boolean {
  const { combos } = partitionHand(hand);
  return combos.some((c) => c.combatPower >= DEFENSE_THRESHOLD);
}

/**
 * 计算手牌"最强组"的战斗力（无则 0）
 */
export function maxCombatPower(hand: Card[]): number {
  const { combos } = partitionHand(hand);
  if (combos.length === 0) return 0;
  return Math.max(...combos.map((c) => c.combatPower));
}
