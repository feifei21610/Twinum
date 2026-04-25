/**
 * 对局日志工具
 *
 * 把 Action + 执行前后的 GameState 翻译成人类可读的日志条目，
 * 供 UI 抽屉展示 + 开发模式 console.debug 使用。
 *
 * 设计原则：
 *   - 只读工具，不修改任何 state
 *   - 日志在 store 层（dispatchAction）生成，引擎保持纯函数
 *   - 每条日志记录"谁、做了什么"的完整快照，无需查引擎内部
 */
import type { Action, Card, GameState } from '../types/game';
import { faceValue } from '../types/game';

export interface GameLogEntry {
  /** 轮次（1-based） */
  round: number;
  /** 本轮内第几步（1-based，按发生顺序） */
  turnInRound: number;
  /** 行动玩家名（如 '你'、'bot1'） */
  playerName: string;
  /** 行动玩家是否人类 */
  isHuman: boolean;
  /** 动作类型（用于 UI 着色） */
  actionKind: Action['type'];
  /** 简洁可读文本（一行，如 "你 · Show 出 3 张 [5,5,5]"） */
  text: string;
  /** 时间戳（排序稳定用） */
  timestamp: number;
}

/**
 * 把 Action + 执行前后的 state 翻译成一条日志。
 *
 * 在 store 的 dispatchAction 里调用：
 *   const entry = buildLogEntry(prevState, action);
 *   set({ log: [...log, entry] });
 *
 * 重要：player 和 hand 快照必须来自 prev（执行前），
 * 否则 cardIndexes 映射不回原牌。
 */
export function buildLogEntry(prev: GameState, action: Action): GameLogEntry {
  const player = prev.players[prev.currentPlayerIndex];
  const entry: GameLogEntry = {
    round: prev.round,
    turnInRound: prev.turnInRound + 1, // turnInRound 在 applyAction 里才 +1，日志用 +1 后的值
    playerName: player.name,
    isHuman: player.type === 'human',
    actionKind: action.type,
    text: formatActionText(prev, action),
    timestamp: Date.now(),
  };
  return entry;
}

/** 把 action 翻译成可读文本（单行） */
function formatActionText(prev: GameState, action: Action): string {
  const player = prev.players[prev.currentPlayerIndex];
  const who = player.name;

  switch (action.type) {
    case 'SHOW': {
      const cards = action.cardIndexes.map((i) => faceValue(player.hand[i]));
      return `${who} · Show 出 ${cards.length} 张 [${cards.join(',')}]`;
    }

    case 'SCOUT': {
      if (!prev.activeSet) return `${who} · Scout (场上无牌?)`;
      const scoutedCard = getScoutedCard(prev.activeSet.cards, action.from);
      const rawValue = faceValue(scoutedCard);
      const flippedValue = action.flip
        ? scoutedCard.flipped
          ? scoutedCard.top
          : scoutedCard.bottom
        : rawValue;
      const fromLabel = action.from === 'left' ? '左端' : '右端';
      const flipDesc = action.flip
        ? `[${rawValue}]→翻面变 ${flippedValue}`
        : `[${rawValue}]`;
      return `${who} · Scout 从${fromLabel}抽 ${flipDesc}，插入 index ${action.insertAt}`;
    }

    case 'SCOUT_AND_SHOW': {
      if (!prev.activeSet) return `${who} · Scout&Show (场上无牌?)`;
      const scoutedCard = getScoutedCard(prev.activeSet.cards, action.scout.from);
      const rawValue = faceValue(scoutedCard);
      const flippedValue = action.scout.flip
        ? scoutedCard.flipped
          ? scoutedCard.top
          : scoutedCard.bottom
        : rawValue;
      const fromLabel = action.scout.from === 'left' ? '左端' : '右端';
      const scoutDesc = action.scout.flip
        ? `[${rawValue}]→${flippedValue}`
        : `[${rawValue}]`;

      // 模拟插入后的手牌，再按 show 里的 index 映射面值
      const inserted = action.scout.flip
        ? { ...scoutedCard, flipped: !scoutedCard.flipped }
        : scoutedCard;
      const newHand = [...player.hand];
      newHand.splice(Math.max(0, Math.min(action.scout.insertAt, newHand.length)), 0, inserted);
      const shownCards = action.show.map((i) => faceValue(newHand[i]));

      return `${who} · S&S 抽${fromLabel}${scoutDesc} → 出 ${shownCards.length} 张 [${shownCards.join(',')}]`;
    }

    case 'FLIP_HAND':
      return `${who} · 整副手牌翻面`;

    default: {
      // 穷举保护
      const _exhaustive: never = action;
      return `${who} · Unknown action ${JSON.stringify(_exhaustive)}`;
    }
  }
}

function getScoutedCard(cards: Card[], from: 'left' | 'right'): Card {
  return from === 'left' ? cards[0] : cards[cards.length - 1];
}
