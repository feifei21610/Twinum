/**
 * Twinum 游戏状态管理（Zustand）
 *
 * 设计原则（符合 plan"联机兼容三原则"）：
 *   1. 不在 store/UI 写规则 —— 全部委托给 game-engine 纯函数
 *   2. 所有状态变化走 dispatchAction(action) —— 未来 WebSocket 直接广播同一 Action
 *   3. Bot 接口与未来 remote 玩家同形 —— store 不关心是 Bot 还是 Remote，只调 agent.act()
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Action, BotConfigKey, GameState } from '../types/game';
import {
  applyAction,
  finalizeRoundIfNeeded,
  isGameOver,
  rebuildRng,
  startNewGame,
  startNextRound,
} from '../game-engine';
import { STORAGE_PREFIX } from '../constants/game';
import { buildLogEntry, type GameLogEntry } from '../utils/game-log';

export type RouteName = 'start' | 'game' | 'result' | 'rules';

export interface GameStoreState {
  // ========== 路由 ==========
  route: RouteName;

  // ========== 游戏状态 ==========
  game: GameState | null;

  // ========== 对局日志 ==========
  /** 本局所有可读日志条目（按发生顺序） */
  log: GameLogEntry[];

  // ========== UI 状态 ==========
  /** 玩家选中的手牌 index 列表（用于组装 Show 动作）；Bot 回合此字段清空 */
  selectedHandIndexes: number[];
  /** Bot 是否正在"思考"（UI 展示打字机省略号用） */
  botThinking: boolean;
  /** 最近一次的错误消息（UI 小 toast） */
  lastError: string | null;
}

export interface GameStoreActions {
  // ========== 路由 ==========
  goto: (route: RouteName) => void;

  // ========== 游戏流程 ==========
  /** 开始新游戏（若有 seed 可复现） */
  startGame: (opts?: { seed?: string; botConfigs?: BotConfigKey[] }) => void;
  /** 上一局结束后的"再来一局"：完全重开 */
  restartGame: () => void;
  /** 手动进入下一轮（回合结束后） */
  continueToNextRound: () => void;

  // ========== 动作派发 ==========
  /** 派发动作：人类玩家点击按钮 / Bot 决策结果 */
  dispatchAction: (action: Action) => void;

  // ========== UI 辅助 ==========
  toggleSelectCard: (index: number) => void;
  clearSelection: () => void;
  setBotThinking: (thinking: boolean) => void;
  clearError: () => void;
}

export type GameStore = GameStoreState & GameStoreActions;

// ========== 初始状态 ==========

const initialState: GameStoreState = {
  route: 'start',
  game: null,
  log: [],
  selectedHandIndexes: [],
  botThinking: false,
  lastError: null,
};

// ========== Store 实现 ==========

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      goto: (route) => set({ route }),

      startGame: (opts = {}) => {
        // MVP 4 人局：1 人类 + 3 Bot；所有 Bot 决策逻辑相同，传 'STEADY'/'RUSH' 仅是 BotConfigKey 分组，暂不影响决策
        const { state } = startNewGame({
          seed: opts.seed,
          botConfigs: opts.botConfigs ?? ['STEADY', 'STEADY', 'STEADY'],
        });
        set({
          game: state,
          route: 'game',
          log: [], // 开新局：清空日志
          selectedHandIndexes: [],
          botThinking: false,
          lastError: null,
        });
      },

      restartGame: () => {
        get().startGame();
      },

      continueToNextRound: () => {
        const { game, log } = get();
        if (!game) return;
        if (game.phase !== 'roundEnd') {
          console.error('[continueToNextRound] not in roundEnd phase');
          return;
        }
        const rng = rebuildRng(`${game.seed}-r${game.round + 1}`);
        const next = startNextRound(game, rng);
        // 日志保留最近 2 轮（当前进入的新轮 + 上一轮）
        const keepFromRound = next.round - 1;
        const trimmedLog = log.filter((e) => e.round >= keepFromRound);
        set({
          game: next,
          log: trimmedLog,
          selectedHandIndexes: [],
          route: next.phase === 'gameEnd' ? 'result' : 'game',
        });
      },

      dispatchAction: (action) => {
        const { game, log } = get();
        if (!game) {
          console.error('[dispatchAction] no active game');
          return;
        }
        const prev = game;
        const next = applyAction(prev, action);

        // 如果 applyAction 没有产生变化 → 非法动作
        if (next === prev) {
          set({ lastError: '非法动作（UI 层理论上不会触发）' });
          return;
        }

        // 生成日志条目（基于 prev state）
        const logEntry = buildLogEntry(prev, action);
        const newLog = [...log, logEntry];

        // 开发模式下同步打印到 console（便于 debug）
        if (import.meta.env.DEV) {
          console.debug(
            `%c[R${logEntry.round}T${logEntry.turnInRound}]%c ${logEntry.text}`,
            'color: #8B5CF6; font-weight: bold',
            'color: inherit',
          );
        }

        // 自动处理 phase 转换
        if (next.phase === 'roundEnd') {
          set({
            game: next,
            log: newLog,
            selectedHandIndexes: [],
            botThinking: false,
            lastError: null,
          });
          return;
        }

        if (isGameOver(next)) {
          set({
            game: next,
            log: newLog,
            route: 'result',
            selectedHandIndexes: [],
            botThinking: false,
            lastError: null,
          });
          return;
        }

        set({
          game: next,
          log: newLog,
          selectedHandIndexes: [],
          lastError: null,
        });
      },

      toggleSelectCard: (index) => {
        const { selectedHandIndexes } = get();
        const has = selectedHandIndexes.includes(index);
        const next = has
          ? selectedHandIndexes.filter((i) => i !== index)
          : [...selectedHandIndexes, index].sort((a, b) => a - b);
        set({ selectedHandIndexes: next });
      },

      clearSelection: () => set({ selectedHandIndexes: [] }),

      setBotThinking: (thinking) => set({ botThinking: thinking }),

      clearError: () => set({ lastError: null }),
    }),
    {
      name: `${STORAGE_PREFIX}game`, // localStorage key
      storage: createJSONStorage(() => localStorage),
      // 只持久化核心游戏状态和路由，不持久化瞬时 UI 状态
      partialize: (state) => ({
        route: state.route,
        game: state.game,
      }),
      // 读取失败时的兜底（比如 schema 变更）
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('[gameStore] rehydrate error', error);
        }
        if (state) {
          // 清理可能残留的 UI 临时状态
          state.selectedHandIndexes = [];
          state.botThinking = false;
          state.lastError = null;
          state.log = []; // 日志不持久化（续玩时从当前状态重新累积即可）
        }
      },
    },
  ),
);

// ========== 便捷选择器 ==========

/** 获取游戏状态（null 表示尚未开始） */
export const selectGame = (s: GameStore) => s.game;

/** 获取当前路由 */
export const selectRoute = (s: GameStore) => s.route;

/** 获取当前回合玩家 index（若无 game 返回 null） */
export const selectCurrentPlayerIndex = (s: GameStore) =>
  s.game?.currentPlayerIndex ?? null;

/** 判断当前是否为人类玩家回合 */
export const selectIsHumanTurn = (s: GameStore) => {
  if (!s.game) return false;
  if (s.game.phase !== 'playing') return false;
  return s.game.players[s.game.currentPlayerIndex]?.type === 'human';
};

/** 判断是否应该触发 Bot 自动决策 */
export const selectShouldRunBot = (s: GameStore) => {
  if (!s.game) return false;
  if (s.game.phase !== 'playing') return false;
  return s.game.players[s.game.currentPlayerIndex]?.type === 'bot';
};

// 辅助：用于 UI 层判断 finalizeRoundIfNeeded 是否需要弹"本轮结束"
export const selectRoundEndData = (s: GameStore) => {
  if (!s.game) return null;
  return finalizeRoundIfNeeded(s.game);
};
