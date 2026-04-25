/**
 * 状态转移：applyAction(state, action) => newState
 * 所有规则细节在此集中实现，保持纯函数 + 不可变。
 *
 * 严格对齐 scout/docs/03-game-rules.md：
 *   - Show 后原 Active Set 翻面进入玩家已收集牌；新牌组成为 Active Set
 *   - Scout：从 Active Set 左/右端抽 1 张，可翻面，插入手牌任意位置；owner 得 1 个 Scout Chip
 *   - Scout & Show：消耗 Scout&Show Chip；先 Scout 再 Show
 *   - 回合结束条件：
 *       i  Show 后手牌为空
 *       ii Show 后其他所有人都只 Scout 不 Show（一圈回到 Show 人）
 *   - FLIP_HAND：仅回合开局（hasActedThisRound[playerIndex] === false）可用
 */
import type { Action, CardGroup, GameState, Card } from '../types/game';
import { faceValue } from '../types/game';
import { canBeat, tryBuildGroupFromHand } from './rules';

// ========== 工具 ==========

function clone<T>(x: T): T {
  // 简单深拷贝（GameState 里只有普通对象/数组，结构化克隆足够）
  return structuredClone(x);
}

/**
 * 把一张卡翻面（返回新卡，不修改原卡）
 */
function flipCard(card: Card): Card {
  return { ...card, flipped: !card.flipped };
}

/**
 * 计算下一位玩家的 index（顺时针）
 */
function nextPlayerIndex(current: number, total: number): number {
  return (current + 1) % total;
}

// ========== 单个动作的实现 ==========

/**
 * 应用 SHOW
 *
 * 过程：
 *   1. 校验合法性（构造牌组 + 能盖过 active）
 *   2. 从手牌里拿走 cardIndexes 对应的牌
 *   3. 原 Active Set（如果有）翻面，进入当前玩家的 collectedCards
 *   4. 新牌组成为 Active Set，owner = 当前玩家
 *   5. 判断回合结束条件 i（手牌空）
 *   6. 否则流转到下一玩家
 *
 * 返回修改后的 state（不合法返回 null，调用方 log error 并保持原 state）
 */
export function applyShow(state: GameState, cardIndexes: number[]): GameState | null {
  const currentIdx = state.currentPlayerIndex;
  const player = state.players[currentIdx];
  const group = tryBuildGroupFromHand(player.hand, cardIndexes);
  if (!group) {
    console.error('[applyShow] invalid group for indexes', cardIndexes);
    return null;
  }
  if (!canBeat(group, state.activeSet)) {
    console.error('[applyShow] group cannot beat active set');
    return null;
  }

  const next = clone(state);
  const np = next.players[currentIdx];

  // 从手牌里拿走这几张
  np.hand = np.hand.filter((_, i) => !cardIndexes.includes(i));

  // 原 Active Set 翻面进入玩家已收集牌（注意：进入的是"翻面后的版本"）
  if (next.activeSet) {
    const flipped = next.activeSet.cards.map(flipCard);
    np.collectedCards.push(...flipped);
  }

  // 新 Active Set
  next.activeSet = group;
  next.activeSetOwnerIndex = currentIdx;

  // 回合状态更新
  next.hasActedThisRound[currentIdx] = true;
  next.history.push({ type: 'SHOW', cardIndexes });
  next.lastShowerIndex = currentIdx;
  next.scoutedSinceLastShow = []; // Show 发生，重置

  // 条件 i：手牌出光 → 回合结束
  if (np.hand.length === 0) {
    next.phase = 'roundEnd';
    next.roundEndCondition = 'i';
    next.roundEndConditionTriggerer = currentIdx;
    return next;
  }

  // 否则流转到下一玩家
  next.currentPlayerIndex = nextPlayerIndex(currentIdx, next.players.length);
  next.turnInRound++;
  return next;
}

/**
 * 应用 SCOUT
 * 约束：
 *   - 场上必须有 Active Set
 *   - Active Set 的 owner 不能是自己
 *   - insertAt 必须在 [0, hand.length] 范围
 */
export function applyScout(
  state: GameState,
  opts: { from: 'left' | 'right'; flip: boolean; insertAt: number },
): GameState | null {
  if (!state.activeSet || state.activeSetOwnerIndex == null) {
    console.error('[applyScout] no active set');
    return null;
  }
  if (state.activeSetOwnerIndex === state.currentPlayerIndex) {
    console.error('[applyScout] cannot scout own set');
    return null;
  }

  const next = clone(state);
  const currentIdx = next.currentPlayerIndex;
  const activeSet = next.activeSet!;
  const owner = next.players[next.activeSetOwnerIndex!];
  const me = next.players[currentIdx];

  // 抽出一张
  let pickedIndex: number;
  if (opts.from === 'left') pickedIndex = 0;
  else pickedIndex = activeSet.cards.length - 1;
  const [picked] = activeSet.cards.splice(pickedIndex, 1);

  // 是否翻面
  const inserted = opts.flip ? flipCard(picked) : picked;

  // 插入手牌
  const clampedInsert = Math.max(0, Math.min(opts.insertAt, me.hand.length));
  me.hand.splice(clampedInsert, 0, inserted);

  // owner 得 1 Scout Chip
  owner.scoutChips += 1;

  // 重算 Active Set 的 minValue
  if (activeSet.cards.length > 0) {
    const vals = activeSet.cards.map(faceValue);
    activeSet.minValue = Math.min(...vals);
  } else {
    // 抽空了，Active Set 清空（下一位玩家可随意出）
    next.activeSet = null;
    next.activeSetOwnerIndex = null;
  }

  // 回合状态
  next.hasActedThisRound[currentIdx] = true;
  next.history.push({ type: 'SCOUT', ...opts });

  // 记录本轮 Scout 序列（判断条件 ii 用）
  if (!next.scoutedSinceLastShow.includes(currentIdx)) {
    next.scoutedSinceLastShow.push(currentIdx);
  }

  // 判断回合结束条件 ii：
  //   Show 之后其他所有玩家都只 Scout 不 Show，回到 Show 人那里
  //   = lastShowerIndex 存在 + scoutedSinceLastShow 涵盖了除 lastShower 外的所有人
  if (next.lastShowerIndex != null) {
    const otherPlayerCount = next.players.length - 1;
    const uniqueScouted = new Set(next.scoutedSinceLastShow);
    uniqueScouted.delete(next.lastShowerIndex);
    if (uniqueScouted.size >= otherPlayerCount) {
      // 条件 ii 触发
      next.phase = 'roundEnd';
      next.roundEndCondition = 'ii';
      next.roundEndConditionTriggerer = next.lastShowerIndex;
      return next;
    }
  }

  // 流转
  next.currentPlayerIndex = nextPlayerIndex(currentIdx, next.players.length);
  next.turnInRound++;
  return next;
}

/**
 * 应用 SCOUT_AND_SHOW
 * 消耗 Scout & Show Chip（每局 1 次）
 * 过程：先 Scout（同一玩家不流转），再 Show
 */
export function applyScoutAndShow(
  state: GameState,
  opts: {
    scout: { from: 'left' | 'right'; flip: boolean; insertAt: number };
    show: number[];
  },
): GameState | null {
  const me = state.players[state.currentPlayerIndex];
  if (me.scoutShowChipUsed) {
    console.error('[applyScoutAndShow] Scout&Show chip already used');
    return null;
  }

  // 先跑一次 Scout（但不流转回合）
  const scoutResult = applyScoutWithoutTurnAdvance(state, opts.scout);
  if (!scoutResult) {
    console.error('[applyScoutAndShow] scout step failed');
    return null;
  }
  // 标记 chip 已用
  scoutResult.players[scoutResult.currentPlayerIndex].scoutShowChipUsed = true;

  // 再 Show（基于 Scout 后的状态）
  const showResult = applyShow(scoutResult, opts.show);
  if (!showResult) {
    console.error('[applyScoutAndShow] show step failed');
    return null;
  }
  // 把 history 里的 2 条动作合并为一条，便于回放
  showResult.history.splice(showResult.history.length - 2, 2, {
    type: 'SCOUT_AND_SHOW',
    scout: opts.scout,
    show: opts.show,
  });
  return showResult;
}

/**
 * 内部辅助：执行 Scout 但不推进回合（用于 ScoutAndShow 的第一步）
 */
function applyScoutWithoutTurnAdvance(
  state: GameState,
  opts: { from: 'left' | 'right'; flip: boolean; insertAt: number },
): GameState | null {
  const before = clone(state);
  const after = applyScout(state, opts);
  if (!after) return null;
  // ScoutAndShow 的 Scout 步不应该被"条件 ii"提前终止 —— 因为紧接着还要 Show。
  // 如果判定触发了 roundEnd，强制撤销回 playing（Show 步要么成功、要么失败回滚整个动作）。
  if (after.phase === 'roundEnd') {
    after.phase = 'playing';
    after.roundEndCondition = null;
    after.roundEndConditionTriggerer = null;
  }
  // 把回合指针倒回来 + hasActedThisRound 重置（Show 那步会重新置 true）
  after.currentPlayerIndex = before.currentPlayerIndex;
  after.hasActedThisRound[before.currentPlayerIndex] = false;
  after.turnInRound = before.turnInRound;
  return after;
}

/**
 * 应用 FLIP_HAND
 * 仅当该玩家本轮还未做任何动作时可用；不改变 currentPlayerIndex（翻完还是他的回合）
 */
export function applyFlipHand(state: GameState): GameState | null {
  const currentIdx = state.currentPlayerIndex;
  if (state.hasActedThisRound[currentIdx]) {
    console.error('[applyFlipHand] already acted this round');
    return null;
  }
  const next = clone(state);
  const me = next.players[currentIdx];
  me.hand = me.hand.map(flipCard);
  next.history.push({ type: 'FLIP_HAND' });
  // 不设置 hasActedThisRound：Flip Hand 不算"动作"（官方规则允许翻完再出牌），
  // 但为了防止来回翻，只允许翻一次——通过 history 里最近一条判断
  // 简化：用一个字段更清晰。这里采用"flip 只能做一次"的办法：
  //   翻完后 hasActedThisRound 仍然是 false，但加一个隐形标记
  //   我们用 history 里最近一条是否为 FLIP_HAND 来判断（UI 按钮置灰）
  return next;
}

// ========== 统一入口 ==========

/**
 * 统一动作派发入口
 */
export function applyAction(state: GameState, action: Action): GameState {
  let result: GameState | null;
  switch (action.type) {
    case 'SHOW':
      result = applyShow(state, action.cardIndexes);
      break;
    case 'SCOUT':
      result = applyScout(state, {
        from: action.from,
        flip: action.flip,
        insertAt: action.insertAt,
      });
      break;
    case 'SCOUT_AND_SHOW':
      result = applyScoutAndShow(state, action);
      break;
    case 'FLIP_HAND':
      result = applyFlipHand(state);
      break;
    default:
      console.error('[applyAction] unknown action', action);
      return state;
  }
  // 非法动作：返回原 state（UI 层已经置灰，通常不会到这）
  return result ?? state;
}

/**
 * 辅助：判断该玩家本轮是否已经翻过手牌（last FLIP_HAND 在 hasActed 之前）
 * 简单实现：若 history 里从"本轮开始"起存在 FLIP_HAND 即视为已翻
 */
export function hasFlippedHandThisRound(state: GameState): boolean {
  // 简化：遍历 history 从末尾往前，遇到 SHOW/SCOUT/SCOUT_AND_SHOW 停止
  for (let i = state.history.length - 1; i >= 0; i--) {
    const h = state.history[i];
    if (h.type === 'FLIP_HAND') return true;
    // 任意正式动作出现都意味着已进入正式出牌阶段，不再能翻
    if (h.type === 'SHOW' || h.type === 'SCOUT' || h.type === 'SCOUT_AND_SHOW') return false;
  }
  return false;
}

// 用以拼入一个场景未使用的 CardGroup 导入，防止 TS 报未使用
export type _CardGroup = CardGroup;
