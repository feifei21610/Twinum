/**
 * 合法性校验 & 强弱比较
 * 严格对齐 scout/docs/03-game-rules.md "Show（合法性）" 与 "Show（强弱比较）"
 */
import type { Card, CardGroup, CardGroupKind, GameState, Action } from '../types/game';
import { faceValue } from '../types/game';

function isValidCardLike(card: unknown): card is Card {
  if (!card || typeof card !== 'object') return false;
  const maybe = card as Partial<Card>;
  return (
    typeof maybe.id === 'string'
    && typeof maybe.top === 'number'
    && typeof maybe.bottom === 'number'
    && typeof maybe.flipped === 'boolean'
  );
}

// ========== 合法牌组判定 ==========

/**
 * 判断一组（已按手牌顺序取出的）卡牌是否构成合法牌组
 * 合法牌组 = 相同数字组 OR 连续数字组（升序 OR 降序都算）
 *
 * @returns CardGroup 或 null（不合法）
 */
export function tryBuildGroup(cards: Card[]): CardGroup | null {
  if (cards.length === 0) return null;
  if (cards.some((c) => !isValidCardLike(c))) return null;

  // 单张牌：任意一张都合法，视为"相同数字组"（长度 1）
  if (cards.length === 1) {
    const v = faceValue(cards[0]);
    return { kind: 'same', cards: [...cards], minValue: v };
  }

  const values = cards.map(faceValue);

  // 相同数字组
  const allSame = values.every((v) => v === values[0]);
  if (allSame) {
    return { kind: 'same', cards: [...cards], minValue: values[0] };
  }

  // 连续数字组（升序 或 降序）
  const isAscending = values.every((v, i) => i === 0 || v === values[i - 1] + 1);
  const isDescending = values.every((v, i) => i === 0 || v === values[i - 1] - 1);
  if (isAscending || isDescending) {
    return {
      kind: 'run',
      cards: [...cards],
      minValue: Math.min(...values),
    };
  }

  return null;
}

/**
 * 判断从 hand 中取出 [cardIndexes]（必须相邻且单调递增）对应的 cards 是否构成合法牌组
 */
export function tryBuildGroupFromHand(hand: Card[], cardIndexes: number[]): CardGroup | null {
  if (cardIndexes.length === 0) return null;
  // 检查 index 是否有序且相邻
  for (let i = 0; i < cardIndexes.length; i++) {
    if (cardIndexes[i] < 0 || cardIndexes[i] >= hand.length) return null;
    if (i > 0 && cardIndexes[i] !== cardIndexes[i - 1] + 1) return null;
  }
  const picked = cardIndexes.map((i) => hand[i]);
  return tryBuildGroup(picked);
}

// ========== 强弱比较 ==========

/**
 * 比较两个牌组的强弱
 * 返回：
 *   >0 → challenger 更强
 *   0  → 等强（按官方规则不能盖过同强度，所以 0 视为"不能出"）
 *   <0 → active 更强
 *
 * 判定顺序（官方）：
 *   1. 张数：多的强
 *   2. 同张数：same > run（相同数字组 > 连续数字组）
 *   3. 同张数 + 同类型：最小数字大的强
 */
export function compareGroups(challenger: CardGroup, active: CardGroup): number {
  // 1. 张数
  if (challenger.cards.length !== active.cards.length) {
    return challenger.cards.length - active.cards.length;
  }

  // 2. 类型（same > run）
  const kindRank: Record<CardGroupKind, number> = { same: 2, run: 1 };
  if (kindRank[challenger.kind] !== kindRank[active.kind]) {
    return kindRank[challenger.kind] - kindRank[active.kind];
  }

  // 3. 最小数字
  return challenger.minValue - active.minValue;
}

/**
 * 判断 challenger 是否足以盖过 active
 */
export function canBeat(challenger: CardGroup, active: CardGroup | null): boolean {
  if (active == null) return true; // 场上无牌时任意合法组都可出
  return compareGroups(challenger, active) > 0;
}

// ========== 合法动作枚举 ==========

/**
 * 枚举所有"能盖过场上"的合法 Show 候选（或场上无牌时所有合法牌组）
 * 只枚举"相邻"的子串（长度 1..hand.length），避免组合爆炸
 */
export function enumerateLegalShows(hand: Card[], activeSet: CardGroup | null): CardGroup[] {
  const results: CardGroup[] = [];
  for (let start = 0; start < hand.length; start++) {
    for (let end = start; end < hand.length; end++) {
      const cards = hand.slice(start, end + 1);
      const group = tryBuildGroup(cards);
      if (group && canBeat(group, activeSet)) {
        // 记录原始 hand 中的起止 index
        (group as CardGroup & { __startIndex?: number; __endIndex?: number }).__startIndex = start;
        (group as CardGroup & { __startIndex?: number; __endIndex?: number }).__endIndex = end;
        results.push(group);
      }
    }
  }
  return results;
}

/**
 * 获取当前玩家的所有合法 Action（供 UI 按钮置灰判断 & Bot 决策使用）
 *
 * @returns 合法动作分组；每类可能是空数组
 */
export interface LegalActions {
  shows: Array<{ cardIndexes: number[]; group: CardGroup }>;
  /** 每个 SCOUT 动作（left/right × flip 正反 × 可插入位置数）；数量可能较多但数组里只返回几个代表（left/right × flip 2 种），插入位置由 Bot/UI 决定 */
  scouts: Array<{ from: 'left' | 'right'; flip: boolean }>;
  canScout: boolean;
  canFlipHand: boolean;
  canScoutAndShow: boolean; // 是否可以用 Scout&Show（Chip 还在 + 当前场上有牌）
}

export function legalActionsFor(state: GameState, playerIndex: number): LegalActions {
  const player = state.players[playerIndex];
  const isCurrent = state.currentPlayerIndex === playerIndex;
  const isPlaying = state.phase === 'playing';

  // 非当前玩家 / 非 playing 阶段：什么都不能做
  if (!isCurrent || !isPlaying) {
    return {
      shows: [],
      scouts: [],
      canScout: false,
      canFlipHand: false,
      canScoutAndShow: false,
    };
  }

  // Show
  const showGroups = enumerateLegalShows(player.hand, state.activeSet);
  const shows = showGroups.map((g) => {
    const anyG = g as CardGroup & { __startIndex: number; __endIndex: number };
    const cardIndexes: number[] = [];
    for (let i = anyG.__startIndex; i <= anyG.__endIndex; i++) cardIndexes.push(i);
    return { cardIndexes, group: g };
  });

  // Scout：场上有 Active Set 且 owner 不是自己
  const hasActive = state.activeSet != null;
  const ownedByOther =
    hasActive && state.activeSetOwnerIndex != null && state.activeSetOwnerIndex !== playerIndex;
  const canScout = !!ownedByOther;
  const scouts: Array<{ from: 'left' | 'right'; flip: boolean }> = [];
  if (canScout) {
    scouts.push({ from: 'left', flip: false });
    scouts.push({ from: 'left', flip: true });
    // 如果 active set 只有 1 张，left 和 right 是同一张，不用重复
    if (state.activeSet && state.activeSet.cards.length > 1) {
      scouts.push({ from: 'right', flip: false });
      scouts.push({ from: 'right', flip: true });
    }
  }

  // Flip Hand：仅在本玩家本轮还未做任何动作前可用
  const canFlipHand = !state.hasActedThisRound[playerIndex];

  // Scout & Show：Chip 未用 + 能 Scout + 至少有一种 Scout 后能 Show 的方案
  // 简化：先返回"可能可以"；精确判断放到 actions 层（避免枚举太重）
  const canScoutAndShow = canScout && !player.scoutShowChipUsed;

  return { shows, scouts, canScout, canFlipHand, canScoutAndShow };
}

// ========== Show 失败原因诊断 ==========

/**
 * 诊断玩家当前选牌无法 Show 的具体原因。
 *
 * 优先级（越早越高）：
 *   1. 未选牌
 *   2. 所选牌在手牌中位置不相邻（有跳跃）
 *   3. 所选牌不构成合法组（非同数字、非连续数字）
 *   4. 合法但压不过场上牌组
 *   5. 合法且能盖过 → 返回 ''（无错误）
 *
 * @param hand            当前手牌
 * @param selectedIndexes 玩家已选中的手牌下标（顺序不限）
 * @param activeSet       场上当前牌组（null 表示无牌）
 * @returns 中文失败原因字符串，合法时返回空字符串 ''
 */
export function diagnoseShowReason(
  hand: Card[],
  selectedIndexes: number[],
  activeSet: CardGroup | null,
): string {
  // 1. 未选
  if (selectedIndexes.length === 0) return '先选择手牌';

  // 2. 不相邻（排序后逐对检查）
  const sorted = [...selectedIndexes].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return '所选牌必须位置相邻';
  }

  // 3. 不合规
  const cards = sorted.map((i) => hand[i]);
  const group = tryBuildGroup(cards);
  if (!group) return '需同数字或连续数字';

  // 4. 压不过场上
  if (!canBeat(group, activeSet)) return '无法盖过场上（需更大或更长）';

  // 5. 合法
  return '';
}
