/**
 * onlineStore — 联机模式的状态管理
 *
 * 与 gameStore 的关系：
 * - gameStore 管理单机模式的本地权威 GameState
 * - onlineStore 管理联机模式的"我的视角状态"（手牌 + 公共信息）
 *
 * 联机模式下，UI 组件通过 onlineStore 读取状态，
 * 通过 networkClient 发送 Action（不走 gameStore 的 dispatchAction）。
 */
import { create } from 'zustand';
import { networkClient, getRoomIdFromUrl, type LobbySnapshot, type RoundScorePayload } from '../network/client';
import type { Action, Card, CardGroup } from '../types/game';

export type OnlinePhase =
  | 'idle'           // 未连接
  | 'connecting'     // 连接中
  | 'lobby'          // 大厅（等待玩家）
  | 'playing'        // 游戏中
  | 'roundEnd'       // 本轮结束，等待下一轮
  | 'gameOver'       // 整局结束
  | 'error';         // 连接错误

export interface OnlinePlayerInfo {
  index: number;
  name: string;
  type: string;       // 'remote' | 'bot'
  handSize: number;
  collectedCount: number;
  scoutChips: number;
  scoutShowChipUsed: boolean;
  totalScore: number;
  connected?: boolean;
  reconnectDeadline?: number;
}

export interface OnlineGameSnapshot {
  currentPlayerIndex: number;
  startingPlayerIndex?: number;
  round: number;
  totalRounds: number;
  phase: string;
  activeSet: CardGroup | null;
  activeSetOwnerIndex: number | null;
  lastShowerIndex?: number | null;
  scoutedSinceLastShow?: number[];
  turnInRound?: number;
  hasActedThisRound?: boolean[];
  players: OnlinePlayerInfo[];
}

export interface OnlineStoreState {
  phase: OnlinePhase;
  errorMessage: string | null;

  // 我的身份
  myPlayerIndex: number | null;
  myNickname: string;
  roomId: string | null;
  sessionId: string | null;
  isHost: boolean;

  // 大厅信息
  lobby: LobbySnapshot | null;
  targetPlayerCount: number;

  // 游戏中状态
  myHand: Card[];
  gameSnapshot: OnlineGameSnapshot | null;
  lastRoundScores: RoundScorePayload[] | null;
  gameOverResult: Array<{ name: string; totalScore: number }> | null;

  // 最近收到的动作（供日志/动画用）
  lastAction: { playerIndex: number; action: Action } | null;
}

export interface OnlineStoreActions {
  /** 初始化网络连接（设置服务器地址） */
  init: (serverUrl: string) => void;
  /** 创建房间（房主流程） */
  createRoom: (nickname: string, targetPlayerCount: number) => Promise<string>; // 返回 shareUrl
  /** 加入房间（非房主流程，或通过分享链接） */
  joinRoom: (roomId: string, nickname: string) => Promise<void>;
  /** 检测 URL 是否有 room 参数并自动加入 */
  autoJoinFromUrl: (nickname: string) => Promise<boolean>;
  /** 房主点击"开始游戏" */
  startGame: () => void;
  /** 发送游戏动作 */
  sendAction: (action: Action) => void;
  /** 通知服务器进入下一轮 */
  nextRound: () => void;
  /** 断线重连 */
  reconnect: () => Promise<void>;
  /** 离开房间，回到首页 */
  leaveRoom: () => Promise<void>;
  /** 设置昵称（在进入大厅前可更改） */
  setNickname: (name: string) => void;
  /** 设置目标人数（房主在大厅设置） */
  setTargetPlayerCount: (count: number) => void;
}

export type OnlineStore = OnlineStoreState & OnlineStoreActions;

const initialState: OnlineStoreState = {
  phase: 'idle',
  errorMessage: null,
  myPlayerIndex: null,
  myNickname: '',
  roomId: null,
  sessionId: null,
  isHost: false,
  lobby: null,
  targetPlayerCount: 4,
  myHand: [],
  gameSnapshot: null,
  lastRoundScores: null,
  gameOverResult: null,
  lastAction: null,
};

export const useOnlineStore = create<OnlineStore>()((set, get) => ({
  ...initialState,

  init: (serverUrl) => {
    networkClient.init(serverUrl);
  },

  createRoom: async (nickname, targetPlayerCount) => {
    set({ phase: 'connecting', errorMessage: null, myNickname: nickname, targetPlayerCount });
    try {
      const { roomId, shareUrl } = await networkClient.createRoom({ nickname, targetPlayerCount });
      attachNetworkListeners(set, get);
      set({ phase: 'lobby', roomId, sessionId: networkClient.sessionId, isHost: true });
      // 存储 sessionId 到 localStorage 供断线重连用
      if (networkClient.sessionId) {
        localStorage.setItem('twinum:online:roomId', roomId);
        localStorage.setItem('twinum:online:sessionId', networkClient.sessionId);
        localStorage.setItem('twinum:online:nickname', nickname);
      }
      return shareUrl;
    } catch (err) {
      set({ phase: 'error', errorMessage: String(err) });
      throw err;
    }
  },

  joinRoom: async (roomId, nickname) => {
    set({ phase: 'connecting', errorMessage: null, myNickname: nickname });
    try {
      await networkClient.joinRoom(roomId, { nickname });
      attachNetworkListeners(set, get);
      set({ phase: 'lobby', roomId, sessionId: networkClient.sessionId, isHost: false });
      if (networkClient.sessionId) {
        localStorage.setItem('twinum:online:roomId', roomId);
        localStorage.setItem('twinum:online:sessionId', networkClient.sessionId);
        localStorage.setItem('twinum:online:nickname', nickname);
      }
    } catch (err) {
      set({ phase: 'error', errorMessage: String(err) });
      throw err;
    }
  },

  autoJoinFromUrl: async (nickname) => {
    const roomId = getRoomIdFromUrl();
    if (!roomId) return false;
    await get().joinRoom(roomId, nickname);
    return true;
  },

  startGame: () => {
    networkClient.startGame();
  },

  sendAction: (action) => {
    networkClient.sendAction(action);
  },

  nextRound: () => {
    networkClient.nextRound();
  },

  reconnect: async () => {
    set({ phase: 'connecting', errorMessage: null });
    try {
      await networkClient.reconnect();
      attachNetworkListeners(set, get);
      set({ phase: 'playing', roomId: networkClient.roomId, sessionId: networkClient.sessionId });
    } catch (err) {
      set({ phase: 'error', errorMessage: String(err) });
      throw err;
    }
  },

  leaveRoom: async () => {
    await networkClient.leave();
    localStorage.removeItem('twinum:online:roomId');
    localStorage.removeItem('twinum:online:sessionId');
    localStorage.removeItem('twinum:online:nickname');
    set({ ...initialState });
  },

  setNickname: (name) => set({ myNickname: name }),
  setTargetPlayerCount: (count) => set({ targetPlayerCount: count }),
}));

/** 绑定 networkClient 的事件到 store */
function attachNetworkListeners(
  set: (partial: Partial<OnlineStoreState>) => void,
  get: () => OnlineStore,
) {
  networkClient.on('yourSeat', ({ playerIndex }) => {
    set({ myPlayerIndex: playerIndex });
  });

  networkClient.on('lobbyUpdate', (snapshot) => {
    set({ lobby: snapshot });
  });

  networkClient.on('privateHand', ({ hand }) => {
    set({ myHand: sanitizeHand(hand) });
  });

  networkClient.on('actionApplied', (data) => {
    set({ lastAction: data });
  });

  networkClient.on('fullStateSync', ({ hand, gameState }) => {
    const normalizedSnapshot = normalizeSnapshot(gameState as OnlineGameSnapshot);
    set({
      myHand: sanitizeHand(hand),
      gameSnapshot: normalizedSnapshot,
      phase: 'playing',
    });
  });

  networkClient.on('roundEnd', ({ scores }) => {
    set({ phase: 'roundEnd', lastRoundScores: scores });
  });

  networkClient.on('gameOver', ({ players }) => {
    set({ phase: 'gameOver', gameOverResult: players });
  });

  networkClient.on('playerDisconnected', ({ playerIndex, reconnectDeadline }) => {
    const snap = get().gameSnapshot;
    if (!snap) return;
    const players = snap.players.map((p) =>
      p.index === playerIndex ? { ...p, connected: false, reconnectDeadline } : p,
    );
    set({ gameSnapshot: { ...snap, players } });
  });

  networkClient.on('playerReconnected', ({ playerIndex }) => {
    const snap = get().gameSnapshot;
    if (!snap) return;
    const players = snap.players.map((p) =>
      p.index === playerIndex ? { ...p, connected: true, reconnectDeadline: 0 } : p,
    );
    set({ gameSnapshot: { ...snap, players } });
  });

  networkClient.on('playerTakenOverByBot', ({ playerIndex }) => {
    const snap = get().gameSnapshot;
    if (!snap) return;
    const players = snap.players.map((p) =>
      p.index === playerIndex ? { ...p, type: 'bot', connected: true } : p,
    );
    set({ gameSnapshot: { ...snap, players } });
  });

  networkClient.on('error', ({ message }) => {
    console.error('[onlineStore] Server error:', message);
    set({ errorMessage: message });
  });
}

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

function sanitizeHand(hand: unknown): Card[] {
  if (!Array.isArray(hand)) return [];
  return hand.filter(isValidCardLike);
}

function sanitizeActiveSet(activeSet: OnlineGameSnapshot['activeSet']): CardGroup | null {
  if (!activeSet || !Array.isArray(activeSet.cards)) return null;
  const cards = activeSet.cards.filter(isValidCardLike);
  if (cards.length === 0) return null;
  const minValue = Math.min(...cards.map((c) => (c.flipped ? c.bottom : c.top)));
  return {
    kind: activeSet.kind,
    cards,
    minValue,
  };
}

function normalizeSnapshot(snapshot: OnlineGameSnapshot): OnlineGameSnapshot {
  const playerCount = snapshot.players.length;
  const safeCurrent = Number.isInteger(snapshot.currentPlayerIndex)
    ? Math.max(0, Math.min(playerCount - 1, snapshot.currentPlayerIndex))
    : 0;

  return {
    ...snapshot,
    currentPlayerIndex: safeCurrent,
    activeSet: sanitizeActiveSet(snapshot.activeSet),
    hasActedThisRound:
      Array.isArray(snapshot.hasActedThisRound) && snapshot.hasActedThisRound.length === playerCount
        ? snapshot.hasActedThisRound
        : Array(playerCount).fill(true),
    scoutedSinceLastShow: Array.isArray(snapshot.scoutedSinceLastShow)
      ? snapshot.scoutedSinceLastShow.filter((i) => Number.isInteger(i))
      : [],
    turnInRound: typeof snapshot.turnInRound === 'number' ? snapshot.turnInRound : 0,
    startingPlayerIndex: typeof snapshot.startingPlayerIndex === 'number'
      ? snapshot.startingPlayerIndex
      : safeCurrent,
  };
}

/** 便捷选择器 */
export const selectIsMyTurn = (s: OnlineStore): boolean => {
  if (s.phase !== 'playing' || s.myPlayerIndex === null) return false;
  return s.gameSnapshot?.currentPlayerIndex === s.myPlayerIndex;
};
