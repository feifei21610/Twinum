/**
 * Twinum 网络层 — Colyseus 客户端封装
 *
 * 提供：
 * - connect(serverUrl)：连接服务器
 * - createRoom(opts)：创建房间（返回分享链接）
 * - joinRoom(roomId, opts)：通过房间 ID 加入
 * - reconnect()：断线重连（从 sessionStorage 读取 reconnectionToken）
 * - send(action)：发送游戏动作
 * - leave()：离开房间
 * - on(event, handler)：监听服务器事件
 *
 * 上层通过 useOnlineStore（zustand）消费，不直接依赖本模块。
 */
import { Client, Room } from 'colyseus.js';
import type { Action } from '../types/game';

export type ServerUrl = string;

export interface CreateRoomOptions {
  nickname: string;
  targetPlayerCount: number; // 2-5
  targetRounds: number;      // 总轮数
}

export interface JoinRoomOptions {
  nickname: string;
}

export interface RoomEventMap {
  /** 服务器分配的座位信息 */
  yourSeat: (data: { playerIndex: number; nickname: string }) => void;
  /** 大厅状态更新（玩家列表变化） */
  lobbyUpdate: (data: LobbySnapshot) => void;
  /** 有玩家断线 */
  playerDisconnected: (data: { playerIndex: number; nickname: string; reconnectDeadline: number }) => void;
  /** 有玩家重连 */
  playerReconnected: (data: { playerIndex: number; nickname: string }) => void;
  /** 有玩家被 Bot 接管 */
  playerTakenOverByBot: (data: { playerIndex: number; nickname: string }) => void;
  /** 动作被成功应用（广播给所有人，含动画/日志用途） */
  actionApplied: (data: { playerIndex: number; action: Action }) => void;
  /** 私有手牌更新（只发给当前玩家） */
  privateHand: (data: { hand: import('../types/game').Card[] }) => void;
  /** 完整状态同步（断线重连后） */
  fullStateSync: (data: FullStateSyncPayload) => void;
  /** 本轮结束（附计分） */
  roundEnd: (data: { scores: RoundScorePayload[] }) => void;
  /** 整局结束 */
  gameOver: (data: { players: Array<{ name: string; totalScore: number }> }) => void;
  /** 服务端报错 */
  error: (data: { message: string }) => void;
}

export interface LobbySnapshot {
  players: Array<{ playerIndex: number; nickname: string }>;
  targetPlayerCount: number;
  targetRounds: number;
  hostSessionId: string;
}

export interface RoundScorePayload {
  playerIndex: number;
  collectedPoints: number;
  scoutChipPoints: number;
  handPenalty: number;
  total: number;
}

export interface FullStateSyncPayload {
  hand: import('../types/game').Card[];
  gameState: {
    currentPlayerIndex: number;
    startingPlayerIndex?: number;
    round: number;
    totalRounds: number;
    phase: string;
    activeSet: import('../types/game').CardGroup | null;
    activeSetOwnerIndex: number | null;
    lastShowerIndex?: number | null;
    scoutedSinceLastShow?: number[];
    turnInRound?: number;
    hasActedThisRound?: boolean[];
    players: Array<{
      index: number;
      name: string;
      type: string;
      handSize: number;
      collectedCount: number;
      scoutChips: number;
      scoutShowChipUsed: boolean;
      totalScore: number;
    }>;
  };
}

class TwinumNetworkClient {
  private colyseusClient: Client | null = null;
  private room: Room | null = null;
  private handlers: Partial<{ [K in keyof RoomEventMap]: RoomEventMap[K][] }> = {};
  private serverUrl: ServerUrl = '';

  /** 初始化 Colyseus 客户端（不建立 WebSocket，只设置 URL）
   *  带 5s 超时 + 一次自动重试，适配 Fly.io 冷启动 2-5s 唤醒时间 */
  init(serverUrl: ServerUrl) {
    this.serverUrl = serverUrl;
    this.colyseusClient = new Client(serverUrl);
  }

  /** 创建新房间（由房主调用） */
  async createRoom(opts: CreateRoomOptions): Promise<{ roomId: string; shareUrl: string }> {
    if (!this.colyseusClient) throw new Error('未初始化 network client，请先调用 init()');

    this.room = await this.colyseusClient.create('game', {
      nickname: opts.nickname,
      targetPlayerCount: opts.targetPlayerCount,
      targetRounds: opts.targetRounds,
    });

    this.attachRoomListeners();
    this.saveReconnectionToken();

    const shareUrl = buildShareUrl(this.room.roomId);
    return { roomId: this.room.roomId, shareUrl };
  }

  /** 通过房间 ID 加入（非房主） */
  async joinRoom(roomId: string, opts: JoinRoomOptions): Promise<void> {
    if (!this.colyseusClient) throw new Error('未初始化 network client，请先调用 init()');

    this.room = await this.colyseusClient.joinById(roomId, { nickname: opts.nickname });
    this.attachRoomListeners();
    this.saveReconnectionToken();
  }

  /** 断线重连（使用 reconnectionToken，兼容 colyseus.js 0.16） */
  async reconnect(): Promise<void> {
    const token = localStorage.getItem('twinum_reconnection_token');
    if (!token) throw new Error('无重连 token，请重新加入房间');
    if (!this.colyseusClient) {
      if (!this.serverUrl) throw new Error('未初始化 network client');
      this.colyseusClient = new Client(this.serverUrl);
    }

    // colyseus.js 0.16 的 reconnect 接受单个 reconnectionToken 字符串
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.room = await (this.colyseusClient as any).reconnect(token);
    this.attachRoomListeners();
    this.saveReconnectionToken();
  }

  /** @deprecated 旧签名兼容层，新代码请用无参 reconnect() */
  async reconnectById(roomId: string, sessionId: string): Promise<void> {
    if (!this.colyseusClient) throw new Error('未初始化 network client，请先调用 init()');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.room = await (this.colyseusClient as any).reconnect(roomId, sessionId);
    this.attachRoomListeners();
  }

  /** 通知服务器"房主开始游戏" */
  startGame() {
    this.room?.send('startGame');
  }

  /** 通知服务器"进入下一轮" */
  nextRound() {
    this.room?.send('nextRound');
  }

  /** 发送游戏动作 */
  sendAction(action: Action) {
    this.room?.send('action', action);
  }

  /** 离开当前房间 */
  async leave() {
    await this.room?.leave();
    this.room = null;
    this.handlers = {};
    localStorage.removeItem('twinum_reconnection_token');
    localStorage.removeItem('twinum_room_id');
  }

  /** 监听服务器事件 */
  on<K extends keyof RoomEventMap>(event: K, handler: RoomEventMap[K]) {
    if (!this.handlers[event]) {
      (this.handlers as Record<string, unknown[]>)[event] = [];
    }
    (this.handlers[event] as RoomEventMap[K][])!.push(handler);
  }

  off<K extends keyof RoomEventMap>(event: K, handler: RoomEventMap[K]) {
    const list = this.handlers[event] as RoomEventMap[K][] | undefined;
    if (!list) return;
    const idx = list.indexOf(handler);
    if (idx !== -1) list.splice(idx, 1);
  }

  get roomId(): string | null {
    return this.room?.roomId ?? null;
  }

  get sessionId(): string | null {
    return this.room?.sessionId ?? null;
  }

  get isConnected(): boolean {
    return this.room !== null;
  }

  private saveReconnectionToken() {
    if (!this.room) return;
    // colyseus.js 0.16 在 room 对象上暴露 reconnectionToken
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const token = (this.room as any).reconnectionToken as string | undefined;
    if (token) {
      localStorage.setItem('twinum_reconnection_token', token);
      localStorage.setItem('twinum_room_id', this.room.roomId);
    }
  }

  private attachRoomListeners() {
    if (!this.room) return;

    // 把 Colyseus onMessage 桥接到我们的 handlers
    const events: Array<keyof RoomEventMap> = [
      'yourSeat', 'lobbyUpdate', 'playerDisconnected', 'playerReconnected',
      'playerTakenOverByBot', 'actionApplied', 'privateHand', 'fullStateSync',
      'roundEnd', 'gameOver', 'error',
    ];

    for (const event of events) {
      this.room.onMessage(event, (data: unknown) => {
        const list = this.handlers[event] as ((...args: unknown[]) => void)[] | undefined;
        if (!list) return;
        for (const h of list) h(data);
      });
    }

    this.room.onError((code, message) => {
      console.error(`[TwinumNetworkClient] Room error ${code}:`, message);
      const list = this.handlers['error'] as ((d: { message: string }) => void)[] | undefined;
      if (list) for (const h of list) h({ message: message ?? `Error ${code}` });
    });

    this.room.onLeave((code) => {
      console.log(`[TwinumNetworkClient] Left room, code=${code}`);
    });
  }
}

/** 根据当前页面 URL 和 roomId 生成分享链接 */
function buildShareUrl(roomId: string): string {
  const base = window.location.origin + window.location.pathname;
  return `${base}?room=${roomId}`;
}

/** 全局单例 */
export const networkClient = new TwinumNetworkClient();

/** 从 URL 参数中读取 roomId（用于分享链接直接加入） */
export function getRoomIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('room');
}
