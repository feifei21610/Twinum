/**
 * 牌堆生成、洗牌、发牌
 * 严格对齐 scout/docs/03-game-rules.md "牌堆与发牌" 段落
 */
import type { Card } from '../types/game';
import {
  CARDS_TO_REMOVE_BY_PLAYER,
  INITIAL_HAND_SIZE_BY_PLAYER,
  OFFICIAL_DECK,
} from '../constants/game';
import { shuffle, type RNG } from './rng';

/**
 * 为指定玩家数生成初始牌堆（未洗牌）
 * - 3 人：36 张（移除全部 9 张含 10 的牌）
 * - 4 人：44 张（移除 [9,10] 那 1 张）
 * - 5 人：45 张（全部使用）
 *
 * 每张牌生成时，其 flipped 默认为 false（top 朝上）；具体哪一面朝上
 * 由洗牌+随机翻面阶段决定（官方规则要求洗牌时同时洗"上下面朝向"）。
 */
export function generateDeck(playerCount: number): Card[] {
  const removeIndexes = new Set(CARDS_TO_REMOVE_BY_PLAYER[playerCount] ?? []);
  const cards: Card[] = [];
  OFFICIAL_DECK.forEach(([top, bottom], idx) => {
    if (removeIndexes.has(idx)) return;
    cards.push({
      id: `c-${top}-${bottom}`,
      top,
      bottom,
      flipped: false,
    });
  });
  return cards;
}

/**
 * 洗牌（包含随机翻面）
 *
 * 官方规则要求：洗牌时不仅洗"顺序"，还要洗"朝向"（每张牌 50% 概率翻面）。
 */
export function shuffleDeck(deck: readonly Card[], rng: RNG): Card[] {
  const shuffled = shuffle(deck, rng);
  return shuffled.map((c) => ({
    ...c,
    flipped: rng.next() < 0.5,
  }));
}

/**
 * 发牌：按玩家数把牌堆平分给各玩家
 * @returns 每位玩家分到的手牌数组（hands[i] 是 player i 的手牌）
 */
export function dealCards(shuffledDeck: readonly Card[], playerCount: number): Card[][] {
  const perPlayer = INITIAL_HAND_SIZE_BY_PLAYER[playerCount] ?? 0;
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);

  // 按顺序轮流发牌（发给 P0、P1、P2... 循环），更接近真实桌游流程
  for (let round = 0; round < perPlayer; round++) {
    for (let p = 0; p < playerCount; p++) {
      const card = shuffledDeck[round * playerCount + p];
      if (card) hands[p].push(card);
    }
  }
  return hands;
}

/**
 * 查找"起始玩家"：按官方规则，第 1 轮持有"1 和 2"那张牌的玩家为起始玩家
 * 注意：要同时检查正反面（因为这张牌可能被翻过）
 * @returns 起始玩家 index；如果找不到（不应该发生）则返回 0
 */
export function findStartingPlayerIndex(hands: readonly Card[][]): number {
  for (let i = 0; i < hands.length; i++) {
    for (const c of hands[i]) {
      // 检查这张牌的"本体"是否是 [1, 2]（不管朝上哪面）
      const values = [c.top, c.bottom].sort((a, b) => a - b);
      if (values[0] === 1 && values[1] === 2) {
        return i;
      }
    }
  }
  // 防御性：如果因为移除规则这张牌不存在（如 4 人局移除 10-X，不会移除 1-2），返回 0
  return 0;
}
