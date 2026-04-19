/**
 * Bot 决策函数（v2.1 规划驱动版）
 *
 * 决策按 5 级绝对优先级判断（严格顺序，前级命中即最高分）：
 *   🚨 Level 0: 强制 Show（阻止条件 ii 被动触发）
 *      当 nextPlayerIndex === lastShowerIndex 时，我 Scout 就会让上家赚 & 我扣手牌分
 *      → 能 Show 必 Show；不能 Show 但能 Scout&Show 必 Scout&Show；都不能才 Scout 认命
 *   🥇 Level 1: 构建最小防御（手牌无防御组时，优先 Scout 构建）
 *   🥈 Level 2: Scout 消孤（让孤牌/潜在连 → 已成连排）
 *   🥉 Level 3: 直接 Show（整组出已成连排 / 场上空扔孤牌 / 出阻隔物）
 *   Level 4: 兜底（凑超强牌 / Scout 放最右端）
 *
 * Scout & Show 本质 = Scout + Show，仅额外 Chip 保护费惩罚。
 *
 * 严格对齐 scout/docs/06-bot-behavior.md 和 bot-v2-spec.md。
 */
import type { Action, BotConfig, Card, GameState, Player } from '../types/game';
import { faceValue } from '../types/game';
import { canBeat, enumerateLegalShows, legalActionsFor } from '../game-engine/rules';
import type { RNG } from '../game-engine/rng';
import {
  combatPower,
  DEFENSE_THRESHOLD,
  hasDefense,
  maxCombatPower,
  partitionHand,
  type ComboInfo,
  type HandPartition,
  type LatentCombo,
} from './partition';

// ========== 类型 ==========

interface ScoredAction {
  action: Action;
  score: number;
  reason: string; // 调试用
}

interface ScoutParams {
  from: 'left' | 'right';
  flip: boolean;
  insertAt: number;
}

// ========== 工具 ==========

/** 出牌后剩余手牌 */
function handAfterShow(hand: Card[], startIndex: number, endIndex: number): Card[] {
  return [...hand.slice(0, startIndex), ...hand.slice(endIndex + 1)];
}

/** 模拟 Scout 后的手牌 */
function handAfterScout(hand: Card[], picked: Card, flip: boolean, insertAt: number): Card[] {
  const inserted = flip ? { ...picked, flipped: !picked.flipped } : picked;
  const clamped = Math.max(0, Math.min(insertAt, hand.length));
  const newHand = [...hand];
  newHand.splice(clamped, 0, inserted);
  return newHand;
}

/** 枚举所有 Scout 候选（左/右 × 翻/不翻 × 所有插入位置） */
function enumerateScoutCandidates(state: GameState, hand: Card[]): ScoutParams[] {
  if (!state.activeSet) return [];
  const active = state.activeSet;
  const fromOpts: Array<'left' | 'right'> =
    active.cards.length > 1 ? ['left', 'right'] : ['left'];
  const flipOpts = [false, true];
  const result: ScoutParams[] = [];
  for (const from of fromOpts) {
    for (const flip of flipOpts) {
      for (let insertAt = 0; insertAt <= hand.length; insertAt++) {
        result.push({ from, flip, insertAt });
      }
    }
  }
  return result;
}

/** 给 Scout 参数取出的那张牌（含 flip 处理） */
function getScoutedCard(state: GameState, params: ScoutParams): Card {
  const active = state.activeSet!;
  const pickedIdx = params.from === 'left' ? 0 : active.cards.length - 1;
  return active.cards[pickedIdx];
}

// ========== Level 1: 构建防御 ==========

/**
 * 找"能让手牌获得防御组"的最优 Scout 方案
 *
 * 返回 null 表示任何 Scout 都无法构建防御（或场上无可 Scout 的 Active Set）
 */
function findDefenseBuildingScout(
  state: GameState,
  player: Player,
): { params: ScoutParams; newDefense: number } | null {
  if (!state.activeSet || state.activeSetOwnerIndex === null) return null;
  if (state.activeSetOwnerIndex === state.currentPlayerIndex) return null; // 不能 Scout 自己

  let best: { params: ScoutParams; newDefense: number } | null = null;
  const candidates = enumerateScoutCandidates(state, player.hand);

  for (const params of candidates) {
    const picked = getScoutedCard(state, params);
    const newHand = handAfterScout(player.hand, picked, params.flip, params.insertAt);
    const newBest = maxCombatPower(newHand);
    if (newBest < DEFENSE_THRESHOLD) continue;
    if (!best || newBest > best.newDefense) {
      best = { params, newDefense: newBest };
    }
  }
  return best;
}

// ========== Level 2: Scout 消孤 ==========

/**
 * 找"能让孤牌/潜在连 → 已成连排"的最优 Scout 方案
 *
 * 优先级：
 *   1. 潜在连 → 已成连（救 2 张）
 *   2. 孤牌 → 潜在连（解锁未来）
 *   3. 孤牌 → 已成连（救 1 张）
 *
 * 简化判定：比较 Scout 后的 { orphanCount, latentCount, totalCombatPower }
 * 新状态"更好"的标准：孤牌少 > 潜在连少（越少越说明都升级了） > 总战斗力高
 */
function findResolvingScout(
  state: GameState,
  player: Player,
  currentPartition: HandPartition,
): { params: ScoutParams; delta: number } | null {
  if (!state.activeSet || state.activeSetOwnerIndex === null) return null;
  if (state.activeSetOwnerIndex === state.currentPlayerIndex) return null;
  if (currentPartition.orphans.length === 0 && currentPartition.latentCombos.length === 0) {
    return null; // 没孤牌没潜在连，没什么可"消"的
  }

  const candidates = enumerateScoutCandidates(state, player.hand);
  let best: { params: ScoutParams; delta: number } | null = null;

  // 当前分组的"待救援指标"：孤牌数 × 10 + 潜在连数 × 3
  const currentBadness =
    currentPartition.orphans.length * 10 + currentPartition.latentCombos.length * 3;

  for (const params of candidates) {
    const picked = getScoutedCard(state, params);
    const newHand = handAfterScout(player.hand, picked, params.flip, params.insertAt);
    const newPartition = partitionHand(newHand);
    const newBadness =
      newPartition.orphans.length * 10 + newPartition.latentCombos.length * 3;

    // 只要新分组的"待救援指标"比当前小（孤牌/潜在连总和降低）就算有效
    const delta = currentBadness - newBadness;
    if (delta <= 0) continue;

    if (!best || delta > best.delta) {
      best = { params, delta };
    }
  }
  return best;
}

// ========== Level 3: Show 评分 ==========

/**
 * Show 动作打分（v2 精简版）
 *
 * 保留加分项：
 *   - 基础分 showPriority × 10
 *   - 手牌减少分 len × 0.5
 *   - 出光激励 +30
 *   - 吃 Active Set：active.cards.length × 1.5
 *   - 孤张加分（场上空）：每个孤张 +16
 *   - 失防御惩罚：出后无防御 → -10
 *
 * 删除项：长度分、长度偏好、最小数字分、终局冲刺、消孤加分、拼接红利、大组惩罚等
 */
function scoreShow(
  startIndex: number,
  endIndex: number,
  state: GameState,
  player: Player,
  config: BotConfig,
  partition: HandPartition,
): number {
  const len = endIndex - startIndex + 1;
  let score = 0;

  // 基础分
  score += config.showPriority * 10;

  // 手牌减少
  score += len * 0.5;

  // 出光激励（触发条件 i，巨大收益）
  const remaining = player.hand.length - len;
  if (remaining === 0) score += 30;

  // 吃 Active Set（白赚收集牌）
  if (state.activeSet) {
    score += state.activeSet.cards.length * 1.5;
  }

  // 孤张加分（场上空时主动消化孤牌）
  if (state.activeSet == null) {
    const orphanSet = new Set(partition.orphans);
    for (let i = startIndex; i <= endIndex; i++) {
      if (orphanSet.has(i)) score += 16;
    }
    // 如果出的是潜在连的"阻隔物"，也给奖励（让潜在连晋升已成连）
    const blockerSet = new Set(partition.latentCombos.map((lc) => lc.blockerIndex));
    for (let i = startIndex; i <= endIndex; i++) {
      if (blockerSet.has(i)) score += 12;
    }
  }

  // 失防御惩罚
  const handAfter = handAfterShow(player.hand, startIndex, endIndex);
  if (handAfter.length > 0) {
    const hadDefenseBefore = hasDefense(player.hand);
    const hasDefenseAfter = hasDefense(handAfter);
    if (hadDefenseBefore && !hasDefenseAfter) {
      score -= 10;
    }
  }

  return score;
}

/**
 * 找最优 Show 动作
 */
function findBestShow(
  state: GameState,
  player: Player,
  config: BotConfig,
  partition: HandPartition,
): { cardIndexes: number[]; score: number; reason: string } | null {
  const legal = enumerateLegalShows(player.hand, state.activeSet);
  if (legal.length === 0) return null;

  let best: { cardIndexes: number[]; score: number; reason: string } | null = null;
  for (const g of legal) {
    const anyG = g as typeof g & { __startIndex: number; __endIndex: number };
    const s = scoreShow(anyG.__startIndex, anyG.__endIndex, state, player, config, partition);
    const cardIndexes: number[] = [];
    for (let i = anyG.__startIndex; i <= anyG.__endIndex; i++) cardIndexes.push(i);
    if (!best || s > best.score) {
      best = {
        cardIndexes,
        score: s,
        reason: `Show len=${g.cards.length} min=${g.minValue} kind=${g.kind}`,
      };
    }
  }
  return best;
}

// ========== Level 4: 兜底 ==========

/**
 * 找"凑超强牌"的 Scout：能让现有最强组变得更强
 */
function findSuperComboScout(
  state: GameState,
  player: Player,
): { params: ScoutParams; gain: number } | null {
  if (!state.activeSet || state.activeSetOwnerIndex === null) return null;
  if (state.activeSetOwnerIndex === state.currentPlayerIndex) return null;

  const oldBest = maxCombatPower(player.hand);
  if (oldBest === 0) return null; // 没有现成组，不算"超强牌"场景

  let best: { params: ScoutParams; gain: number } | null = null;
  const candidates = enumerateScoutCandidates(state, player.hand);
  for (const params of candidates) {
    const picked = getScoutedCard(state, params);
    const newHand = handAfterScout(player.hand, picked, params.flip, params.insertAt);
    const newBest = maxCombatPower(newHand);
    const gain = newBest - oldBest;
    if (gain <= 0) continue;
    if (!best || gain > best.gain) {
      best = { params, gain };
    }
  }
  return best;
}

/**
 * 兜底 Scout：场上右端、不翻、放手牌最右端
 * （最不破坏现有分组结构的默认动作）
 */
function defaultTailScout(state: GameState, player: Player): ScoutParams | null {
  if (!state.activeSet || state.activeSetOwnerIndex === null) return null;
  if (state.activeSetOwnerIndex === state.currentPlayerIndex) return null;
  return {
    from: 'right',
    flip: false,
    insertAt: player.hand.length,
  };
}

// ========== Scout & Show ==========

/**
 * Scout & Show 评分：
 *   Scout 部分评分（用 Level 1/2 的逻辑） + Show 部分评分 - Chip 保护费
 *
 * 独立枚举所有 Scout 参数组合 × 插入后能 Show 的最优组
 * （不能复用 findResolvingScout 等，因为 S&S 视角下的最优可能在其他 Scout 里）
 */
function findBestScoutAndShow(
  state: GameState,
  player: Player,
  config: BotConfig,
):
  | {
      scout: ScoutParams;
      show: number[];
      score: number;
      reason: string;
    }
  | null {
  if (!state.activeSet || player.scoutShowChipUsed) return null;
  if (state.activeSetOwnerIndex === null || state.activeSetOwnerIndex === state.currentPlayerIndex)
    return null;

  const candidates = enumerateScoutCandidates(state, player.hand);
  let best: {
    scout: ScoutParams;
    show: number[];
    score: number;
    reason: string;
  } | null = null;

  const hadDefenseBefore = hasDefense(player.hand);

  for (const params of candidates) {
    const picked = getScoutedCard(state, params);
    const newHand = handAfterScout(player.hand, picked, params.flip, params.insertAt);

    // 模拟 Scout 后场上 Active Set 的剩余
    const active = state.activeSet;
    const pickedIdx = params.from === 'left' ? 0 : active.cards.length - 1;
    const remainingCards = active.cards.filter((_, i) => i !== pickedIdx);
    let newActive = null;
    if (remainingCards.length > 0) {
      const vals = remainingCards.map(faceValue);
      newActive = { ...active, cards: remainingCards, minValue: Math.min(...vals) };
    }

    // 枚举 Scout 后可 Show 的合法组
    const shows = enumerateLegalShows(newHand, newActive);
    if (shows.length === 0) continue;

    // 对新手牌做分组，以便 scoreShow
    const newPartition = partitionHand(newHand);
    const virtualPlayer: Player = { ...player, hand: newHand };

    let bestShow: {
      cardIndexes: number[];
      score: number;
      len: number;
      minValue: number;
      kind: 'same' | 'run';
    } | null = null;

    for (const g of shows) {
      const anyG = g as typeof g & { __startIndex: number; __endIndex: number };
      const s = scoreShow(
        anyG.__startIndex,
        anyG.__endIndex,
        state,
        virtualPlayer,
        config,
        newPartition,
      );
      const indexes: number[] = [];
      for (let i = anyG.__startIndex; i <= anyG.__endIndex; i++) indexes.push(i);
      if (!bestShow || s > bestShow.score) {
        bestShow = {
          cardIndexes: indexes,
          score: s,
          len: g.cards.length,
          minValue: g.minValue,
          kind: g.kind,
        };
      }
    }
    if (!bestShow) continue;

    // Chip 保护费：已有防御 + 用完后还有剩余手牌 → -3
    const handAfterBoth = handAfterShow(
      newHand,
      bestShow.cardIndexes[0],
      bestShow.cardIndexes[bestShow.cardIndexes.length - 1],
    );
    let penalty = 0;
    if (hadDefenseBefore && handAfterBoth.length > 0) {
      penalty = -3;
    }

    const totalScore = bestShow.score + penalty;
    if (!best || totalScore > best.score) {
      best = {
        scout: params,
        show: bestShow.cardIndexes,
        score: totalScore,
        reason: `Scout&Show showLen=${bestShow.len} min=${bestShow.minValue}${penalty ? ' -chipFee' : ''}`,
      };
    }
  }
  return best;
}

// ========== 主决策函数 ==========

/**
 * 主决策函数：按 4 级优先级返回 Action
 */
export function decide(
  state: GameState,
  playerIndex: number,
  config: BotConfig,
  rng?: RNG,
): Action {
  const player = state.players[playerIndex];
  const legal = legalActionsFor(state, playerIndex);
  const partition = partitionHand(player.hand);

  const scored: ScoredAction[] = [];

  // ========== Level 0: 强制 Show（阻止条件 ii 被动触发） ==========
  //
  // 触发条件：
  //   1. 场上有 lastShower（有人 Show 过）
  //   2. 下一个玩家就是 lastShower（我 Scout 就触发条件 ii）
  //
  // 此时我 Scout → 上家免扣手牌分、我扣手牌分，巨亏。
  // 规则：能 Show 必 Show；能 Scout&Show 必 Scout&Show；都不能才 Scout 认命。
  //
  // 注意：触发时只往 scored 里加"必出"选项，其他层级仍正常计算作为 mistakeRate 次优备选。
  const nextPlayerIndex = (playerIndex + 1) % state.players.length;
  const forceShowTriggered =
    state.lastShowerIndex != null &&
    state.lastShowerIndex !== playerIndex &&
    nextPlayerIndex === state.lastShowerIndex;

  if (forceShowTriggered) {
    // 优先找 Show
    const bestShowForL0 = findBestShow(state, player, config, partition);
    if (
      bestShowForL0 &&
      legal.shows.some(
        (s) =>
          s.cardIndexes.length === bestShowForL0.cardIndexes.length &&
          s.cardIndexes.every((v, i) => v === bestShowForL0.cardIndexes[i]),
      )
    ) {
      scored.push({
        action: { type: 'SHOW', cardIndexes: bestShowForL0.cardIndexes },
        score: 1500 + bestShowForL0.score,
        reason: `L0 force-show (block cond-ii) ${bestShowForL0.reason}`,
      });
    } else if (legal.canScoutAndShow) {
      // Show 不行，用 Scout&Show
      const sas = findBestScoutAndShow(state, player, config);
      if (sas) {
        scored.push({
          action: { type: 'SCOUT_AND_SHOW', scout: sas.scout, show: sas.show },
          score: 1500 + sas.score,
          reason: `L0 force-scout-and-show (block cond-ii) ${sas.reason}`,
        });
      }
    }
    // 若 Show 和 Scout&Show 都不行 → 认命只能 Scout，让下面的 L1-L4 正常出 Scout 候选
  }

  // ========== Level 1: 构建防御 ==========
  if (!hasDefense(player.hand) && legal.canScout) {
    const defensiveScout = findDefenseBuildingScout(state, player);
    if (defensiveScout) {
      scored.push({
        action: {
          type: 'SCOUT',
          from: defensiveScout.params.from,
          flip: defensiveScout.params.flip,
          insertAt: defensiveScout.params.insertAt,
        },
        score: 1000 + defensiveScout.newDefense, // 极高优先级
        reason: `L1 build defense (combatPower→${defensiveScout.newDefense})`,
      });
    }
  }

  // ========== Level 2: Scout 消孤 ==========
  //
  // 规则：Scout 消孤**仅在场上空牌时**优先于 Show。
  //   当场上有 Active Set 且我能 Show 时，Show 的"吃 Active Set"收益压过 Scout 消孤。
  if (legal.canScout && state.activeSet == null) {
    const resolvingScout = findResolvingScout(state, player, partition);
    if (resolvingScout) {
      scored.push({
        action: {
          type: 'SCOUT',
          from: resolvingScout.params.from,
          flip: resolvingScout.params.flip,
          insertAt: resolvingScout.params.insertAt,
        },
        score: 800 + resolvingScout.delta,
        reason: `L2 resolve-onEmpty (Δ=${resolvingScout.delta})`,
      });
    }
  }

  // ========== Level 3: 直接 Show ==========
  //
  // 场上有 Active Set 时优先级抬高到 800（与 L2 消孤同级），
  // 因为"能盖过对手 = 白吃 Active Set = 白赚收集牌"价值很大。
  const bestShow = findBestShow(state, player, config, partition);
  if (
    bestShow &&
    legal.shows.some(
      (s) =>
        s.cardIndexes.length === bestShow.cardIndexes.length &&
        s.cardIndexes.every((v, i) => v === bestShow.cardIndexes[i]),
    )
  ) {
    const baseLevel = state.activeSet ? 800 : 500;
    scored.push({
      action: { type: 'SHOW', cardIndexes: bestShow.cardIndexes },
      score: baseLevel + bestShow.score,
      reason: `L3 ${bestShow.reason}${state.activeSet ? ' (onActive)' : ''}`,
    });
  }

  // ========== Level 2.5: 场上有 Active Set 时，无法 Show 才考虑 Scout 消孤 ==========
  //
  // 这是 L2 的补充分支：场上有 Active 且我不能 Show（只能 Scout），
  // 此时消孤 Scout 比随便抽一张强。
  const canShowOnActive = bestShow != null && state.activeSet != null;
  if (legal.canScout && state.activeSet != null && !canShowOnActive) {
    const resolvingScout = findResolvingScout(state, player, partition);
    if (resolvingScout) {
      scored.push({
        action: {
          type: 'SCOUT',
          from: resolvingScout.params.from,
          flip: resolvingScout.params.flip,
          insertAt: resolvingScout.params.insertAt,
        },
        score: 600 + resolvingScout.delta,
        reason: `L2.5 resolve-noShow (Δ=${resolvingScout.delta})`,
      });
    }
  }

  // ========== Scout & Show（单独一路候选）==========
  if (legal.canScoutAndShow) {
    const sas = findBestScoutAndShow(state, player, config);
    if (sas) {
      scored.push({
        action: {
          type: 'SCOUT_AND_SHOW',
          scout: sas.scout,
          show: sas.show,
        },
        // 本质是 Show，抬到与 L3(onActive) 同级
        score: 800 + sas.score,
        reason: sas.reason,
      });
    }
  }

  // ========== Level 4: 兜底 ==========
  // 凑超强牌（有强组可扩展）
  if (legal.canScout) {
    const superCombo = findSuperComboScout(state, player);
    if (superCombo) {
      scored.push({
        action: {
          type: 'SCOUT',
          from: superCombo.params.from,
          flip: superCombo.params.flip,
          insertAt: superCombo.params.insertAt,
        },
        score: 300 + superCombo.gain,
        reason: `L4 super combo (+${superCombo.gain})`,
      });
    }

    // 兜底尾部 Scout（永远作为最后保底）
    const tail = defaultTailScout(state, player);
    if (tail) {
      scored.push({
        action: {
          type: 'SCOUT',
          from: tail.from,
          flip: tail.flip,
          insertAt: tail.insertAt,
        },
        score: 100,
        reason: `L4 tail scout`,
      });
    }
  }

  // 兜底：啥都没有 → 出第一张单牌
  if (scored.length === 0) {
    console.error(`[decide] no legal action for P${playerIndex}, falling back to single show`);
    if (player.hand.length > 0 && state.activeSet === null) {
      return { type: 'SHOW', cardIndexes: [0] };
    }
    return { type: 'SCOUT', from: 'left', flip: false, insertAt: 0 };
  }

  // ========== 排序 + mistakeRate 选次优 ==========
  // ========== 排序 + mistakeRate 选次优 ==========
  //
  // 注意：L0 强制 Show 触发时禁用 mistakeRate（硬性规则，不允许随机犯错）
  scored.sort((a, b) => b.score - a.score);
  const topIsForceShow = scored.length > 0 && scored[0].reason.startsWith('L0 force');
  const randomFn = rng ? rng.next : Math.random;
  const pickSecondBest =
    !topIsForceShow && scored.length > 1 && randomFn() < config.mistakeRate;
  const chosen = pickSecondBest ? scored[1] : scored[0];

  console.debug(
    `[Bot ${config.key}] P${playerIndex} chose "${chosen.reason}" score=${chosen.score.toFixed(1)} (candidates=${scored.length})`,
  );
  return chosen.action;
}
