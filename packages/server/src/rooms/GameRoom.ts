/**
 * GameRoom — Colyseus 房间
 *
 * 职责：
 * 1. 管理玩家加入/离开/断线重连
 * 2. 持有权威 GameState（从 @twinum/shared 的纯函数维护）
 * 3. 接收客户端 Action 消息 → applyAction → 广播新状态
 * 4. 空位自动补 Bot，Bot 回合自动决策
 * 5. 断线 60 秒内可重连，超时 Bot 接管
 */
import { Room, Client } from 'colyseus';
import { GameRoomState, PlayerPublicSchema, CardGroupSchema, CardSchema } from '../schema/GameRoomState';
import type { Action, GameState, Player } from '@twinum/shared';
import {
  startNewGame,
  startNextRound,
  applyAction,
  isGameOver,
  finalizeRoundIfNeeded,
  rebuildRng,
  createBot,
  legalActionsFor,
} from '@twinum/shared';

const RECONNECT_TIMEOUT_MS = 60_000; // 60 秒
const BOT_THINK_DELAY_MS = 1200;      // Bot 思考延时（ms）

interface JoinOptions {
  nickname?: string;
  targetPlayerCount?: number; // 仅房主创建时有效
}

interface PlayerSession {
  sessionId: string;
  playerIndex: number;
  nickname: string;
  reconnectTimer?: ReturnType<typeof setTimeout>;
}

export class GameRoom extends Room<GameRoomState> {
  autoDispose = true;
  maxClients = 5;

  /** 权威游戏状态（服务端持有，不序列化到 Schema，按需 push 给客户端） */
  private authorityState: GameState | null = null;

  /** sessionId → playerIndex 映射 */
  private sessions = new Map<string, PlayerSession>();

  /** playerIndex → sessionId（Bot 没有 sessionId） */
  private playerIndexToSession = new Map<number, string>();

  /** Bot 回合是否正在处理（防重入） */
  private botRunning = false;

  /** 消息限流：sessionId → {count, windowStart} */
  private rateLimitMap = new Map<string, { count: number; windowStart: number }>();

  onCreate(options: JoinOptions) {
    this.setState(new GameRoomState());
    this.setPatchRate(50); // 20fps 广播，节省流量

    // 房主设定目标人数
    const targetCount = options.targetPlayerCount ?? 4;
    this.state.targetPlayerCount = Math.max(2, Math.min(5, targetCount));
    this.maxClients = this.state.targetPlayerCount; // 按房间配置限制入场

    // 注册消息处理
    this.onMessage('action', (client, action: Action) => {
      if (this.isRateLimited(client.sessionId)) {
        client.send('error', { message: '操作太频繁，请稍候' });
        return;
      }
      this.handlePlayerAction(client, action);
    });

    this.onMessage('startGame', (client) => {
      if (client.sessionId === this.state.hostSessionId) {
        this.startGame();
      }
    });

    this.onMessage('nextRound', (client) => {
      if (client.sessionId === this.state.hostSessionId) {
        this.advanceRound();
      }
    });

    console.log(`[GameRoom] roomId=${this.roomId} event=created target=${this.state.targetPlayerCount}`);
  }

  onJoin(client: Client, options: JoinOptions) {
    // nickname 清洗：去掉控制字符、空值拒绝、最长 16
    const rawNickname = options.nickname ?? '';
    const nickname = rawNickname.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, 16);
    if (!nickname) {
      // 拒绝空 nickname：直接 kick（throw 会触发 Colyseus 的 leave）
      throw new Error('nickname 不能为空');
    }
    const playerIndex = this.sessions.size; // 按加入顺序分配座位

    console.log(`[GameRoom] roomId=${this.roomId} event=join nickname=${nickname} playerIndex=${playerIndex}`);

    // 记录会话
    const session: PlayerSession = { sessionId: client.sessionId, playerIndex, nickname };
    this.sessions.set(client.sessionId, session);
    this.playerIndexToSession.set(playerIndex, client.sessionId);

    // 更新公共状态
    const pub = new PlayerPublicSchema();
    pub.id = `p-${playerIndex}`;
    pub.type = 'remote';
    pub.name = nickname;
    pub.avatarColor = this.pickAvatarColor(playerIndex);
    pub.connected = true;
    this.state.players.set(client.sessionId, pub);
    this.state.seatOrder.push(client.sessionId);

    // 第一个加入的是房主
    if (this.sessions.size === 1) {
      this.state.hostSessionId = client.sessionId;
    }

    // 给客户端发"你是几号座位"
    client.send('yourSeat', { playerIndex, nickname });

    // 通知所有人：有人加入
    this.broadcast('lobbyUpdate', this.getLobbySnapshot());
  }

  onLeave(client: Client, consented: boolean) {
    const session = this.sessions.get(client.sessionId);
    if (!session) return;

    console.log(`[GameRoom] roomId=${this.roomId} event=leave nickname=${session.nickname} consented=${consented}`);

    if (this.state.roomPhase === 'lobby') {
      // 大厅阶段直接移除
      this.removePlayer(client.sessionId);
      return;
    }

    // 游戏中：标记断线，启动 60 秒重连计时
    const pub = this.state.players.get(client.sessionId);
    if (pub) {
      pub.connected = false;
      pub.reconnectDeadline = Date.now() + RECONNECT_TIMEOUT_MS;
    }

    session.reconnectTimer = setTimeout(() => {
      // 超时：Bot 接管
      this.takeoverWithBot(session.playerIndex);
    }, RECONNECT_TIMEOUT_MS);

    this.broadcast('playerDisconnected', {
      playerIndex: session.playerIndex,
      nickname: session.nickname,
      reconnectDeadline: Date.now() + RECONNECT_TIMEOUT_MS,
    });
  }

  async onReconnect(client: Client, _options: JoinOptions) {
    const session = Array.from(this.sessions.values()).find(
      (s) => s.nickname === (_options.nickname ?? ''),
    );
    if (!session) return;

    // 取消 Bot 接管计时
    if (session.reconnectTimer) {
      clearTimeout(session.reconnectTimer);
      session.reconnectTimer = undefined;
    }

    // 更新 sessionId
    this.sessions.delete(session.sessionId);
    session.sessionId = client.sessionId;
    this.sessions.set(client.sessionId, session);
    this.playerIndexToSession.set(session.playerIndex, client.sessionId);

    // 更新公共状态
    const pub = this.state.players.get(session.sessionId);
    if (pub) {
      pub.connected = true;
      pub.reconnectDeadline = 0;
    }

    // 把当前权威状态发给重连的客户端
    if (this.authorityState) {
      client.send('fullStateSync', this.buildClientState(this.authorityState, session.playerIndex));
    }

    this.broadcast('playerReconnected', {
      playerIndex: session.playerIndex,
      nickname: session.nickname,
    });
  }

  onDispose() {
    console.log(`[GameRoom] roomId=${this.roomId} event=disposed`);
  }

  // ===== 游戏流程 =====

  private startGame() {
    const humanCount = this.sessions.size;
    const totalCount = this.state.targetPlayerCount;
    const botCount = totalCount - humanCount;

    if (totalCount < 2 || totalCount > 5) {
      console.warn('[GameRoom] invalid player count');
      return;
    }

    // 构建玩家配置：真人 + Bot 补位
    const botConfigs = Array(botCount).fill('STEADY') as ('STEADY' | 'RUSH')[];

    const { state } = startNewGame({
      playerCount: totalCount,
      botConfigs,
      allBots: false,
    });

    // 把"真人"类型替换为 remote
    const humanSessions = Array.from(this.sessions.values()).sort(
      (a, b) => a.playerIndex - b.playerIndex,
    );
    for (let i = 0; i < humanSessions.length; i++) {
      state.players[i].type = 'remote';
      state.players[i].name = humanSessions[i].nickname;
      state.players[i].id = `p-${i}`;
    }

    this.authorityState = state;
    this.state.roomPhase = 'playing';
    this.syncPublicState(state);

    // 给每个真人发完整状态（含私有手牌）：触发前端 phase → 'playing'
    for (const [sessionId, session] of this.sessions) {
      const client = this.clients.find((c) => c.sessionId === sessionId);
      if (!client) continue;
      client.send('fullStateSync', this.buildClientState(state, session.playerIndex));
    }

    // 如果第一个出牌者是 Bot，启动 Bot 决策
    this.maybeRunBot();
  }

  private handlePlayerAction(client: Client, action: Action) {
    if (!this.authorityState) return;
    const session = this.sessions.get(client.sessionId);
    if (!session) return;

    const current = this.authorityState;
    const expected = current.currentPlayerIndex;

    // 校验：只有当前玩家才能出牌
    if (session.playerIndex !== expected) {
      client.send('error', { message: '不是你的回合' });
      return;
    }

    const next = applyAction(current, action);
    if (next === current) {
      client.send('error', { message: '非法动作' });
      return;
    }

    this.authorityState = next;
    this.syncPublicState(next);
    this.broadcastPrivateHands(next);

    // 广播动作（供所有人看日志/动画）
    this.broadcast('actionApplied', {
      playerIndex: session.playerIndex,
      action,
    });
    this.broadcastFullStateSync(next);

    // 检查回合/整局结束
    if (next.phase === 'roundEnd') {
      const result = finalizeRoundIfNeeded(next);
      this.broadcast('roundEnd', { scores: result?.scores ?? [] });
      return;
    }

    if (isGameOver(next)) {
      this.broadcast('gameOver', { players: next.players.map((p) => ({ name: p.name, totalScore: p.totalScore })) });
      this.state.roomPhase = 'finished';
      return;
    }

    // 下一个可能是 Bot
    this.maybeRunBot();
  }

  private advanceRound() {
    if (!this.authorityState || this.authorityState.phase !== 'roundEnd') return;
    const rng = rebuildRng(`${this.authorityState.seed}-r${this.authorityState.round + 1}`);
    const next = startNextRound(this.authorityState, rng);
    this.authorityState = next;
    this.syncPublicState(next);

    // 给每个真人发新一轮的完整状态（含私有手牌）
    for (const [sessionId, session] of this.sessions) {
      const client = this.clients.find((c) => c.sessionId === sessionId);
      if (!client) continue;
      client.send('fullStateSync', this.buildClientState(next, session.playerIndex));
    }

    if (next.phase === 'gameEnd') {
      this.broadcast('gameOver', { players: next.players.map((p) => ({ name: p.name, totalScore: p.totalScore })) });
      this.state.roomPhase = 'finished';
      return;
    }

    this.maybeRunBot();
  }

  private maybeRunBot() {
    if (!this.authorityState || this.botRunning) return;
    const current = this.authorityState;
    const player = current.players[current.currentPlayerIndex];
    if (player.type !== 'bot') return;

    this.botRunning = true;
    setTimeout(() => {
      let shouldChainBotTurn = false;

      try {
        if (!this.authorityState) return;
        const state = this.authorityState;
        const idx = state.currentPlayerIndex;
        const p = state.players[idx];
        if (p.type !== 'bot') return;

        const bot = createBot(p.botConfigKey ?? 'STEADY');
        let action = bot.act(state, idx);
        let next = applyAction(state, action);

        // Bot 决策异常（非法动作）时，服务端兜底成一个合法动作，避免整局卡死在 bot 回合。
        if (next === state) {
          console.warn(`[GameRoom] bot produced invalid action at idx=${idx}, fallback engaged`, action);
          const fallback = this.buildBotFallbackAction(state, idx);
          if (!fallback) {
            console.error(`[GameRoom] no fallback action available for bot idx=${idx}`);
            return;
          }
          action = fallback;
          next = applyAction(state, action);
          if (next === state) {
            console.error(`[GameRoom] fallback action still invalid for bot idx=${idx}`, action);
            return;
          }
        }

        this.authorityState = next;
        this.syncPublicState(next);
        this.broadcastPrivateHands(next);
        this.broadcast('actionApplied', { playerIndex: idx, action });
        this.broadcastFullStateSync(next);

        if (next.phase === 'roundEnd') {
          const result = finalizeRoundIfNeeded(next);
          this.broadcast('roundEnd', { scores: result?.scores ?? [] });
          return;
        }
        if (isGameOver(next)) {
          this.broadcast('gameOver', {
            players: next.players.map((p0) => ({ name: p0.name, totalScore: p0.totalScore })),
          });
          this.state.roomPhase = 'finished';
          return;
        }

        // 可能连续多个 Bot 回合
        shouldChainBotTurn = true;
      } catch (error) {
        console.error('[GameRoom] bot turn crashed:', error);
      } finally {
        this.botRunning = false;
        if (shouldChainBotTurn) {
          this.maybeRunBot();
        }
      }
    }, BOT_THINK_DELAY_MS);
  }

  private buildBotFallbackAction(state: GameState, playerIndex: number): Action | null {
    const legal = legalActionsFor(state, playerIndex);

    if (legal.shows.length > 0) {
      return { type: 'SHOW', cardIndexes: legal.shows[0].cardIndexes };
    }

    if (legal.canScout && state.activeSet) {
      return {
        type: 'SCOUT',
        from: 'left',
        flip: false,
        insertAt: state.players[playerIndex].hand.length,
      };
    }

    if (legal.canFlipHand) {
      return { type: 'FLIP_HAND' };
    }

    return null;
  }

  private takeoverWithBot(playerIndex: number) {
    if (!this.authorityState) return;
    const player = this.authorityState.players[playerIndex];
    if (player.type === 'bot') return;

    // 把这个玩家标记为 bot
    this.authorityState.players[playerIndex].type = 'bot';
    this.authorityState.players[playerIndex].botConfigKey = 'STEADY';

    // 更新公共状态
    const sessionId = this.playerIndexToSession.get(playerIndex);
    if (sessionId) {
      const pub = this.state.players.get(sessionId);
      if (pub) pub.type = 'bot';
    }

    this.broadcast('playerTakenOverByBot', { playerIndex, nickname: player.name });

    // 如果正好是这个人的回合，立即让 Bot 决策
    if (this.authorityState.currentPlayerIndex === playerIndex) {
      this.maybeRunBot();
    }
  }

  // ===== 状态同步工具 =====

  private syncPublicState(state: GameState) {
    this.state.currentPlayerIndex = state.currentPlayerIndex;
    this.state.round = state.round;
    this.state.totalRounds = state.totalRounds;
    this.state.gamePhase = state.phase;
    this.state.seed = state.seed;
    this.state.activeSetOwnerIndex = state.activeSetOwnerIndex ?? -1;

    // Active Set
    if (state.activeSet) {
      const as = new CardGroupSchema();
      as.kind = state.activeSet.kind;
      as.minValue = state.activeSet.minValue;
      for (const c of state.activeSet.cards) {
        const cs = new CardSchema();
        cs.id = c.id; cs.top = c.top; cs.bottom = c.bottom; cs.flipped = c.flipped;
        as.cards.push(cs);
      }
      this.state.activeSet = as;
    } else {
      this.state.activeSet = null;
    }

    // 更新每个玩家公开信息
    const humanSessions = Array.from(this.sessions.values());
    for (const session of humanSessions) {
      const pub = this.state.players.get(session.sessionId);
      if (!pub) continue;
      const p = state.players[session.playerIndex];
      if (!p) continue;
      pub.handSize = p.hand.length;
      pub.collectedCount = p.collectedCards.length;
      pub.scoutChips = p.scoutChips;
      pub.scoutShowChipUsed = p.scoutShowChipUsed;
      pub.totalScore = p.totalScore;
    }
  }

  /** 把每个真人玩家的私有手牌单独发给他 */
  private broadcastPrivateHands(state: GameState) {
    for (const [sessionId, session] of this.sessions) {
      const client = this.clients.find((c) => c.sessionId === sessionId);
      if (!client) continue;
      const player = state.players[session.playerIndex];
      if (!player) continue;
      client.send('privateHand', { hand: player.hand });
    }
  }

  /** 给所有真人客户端广播完整状态快照 */
  private broadcastFullStateSync(state: GameState) {
    for (const [sessionId, session] of this.sessions) {
      const client = this.clients.find((c) => c.sessionId === sessionId);
      if (!client) continue;
      client.send('fullStateSync', this.buildClientState(state, session.playerIndex));
    }
  }

  /** 构建给客户端的完整状态快照 */
  private buildClientState(state: GameState, playerIndex: number) {
    const player = state.players[playerIndex];
    return {
      hand: player?.hand ?? [],
      gameState: {
        currentPlayerIndex: state.currentPlayerIndex,
        startingPlayerIndex: state.startingPlayerIndex,
        round: state.round,
        totalRounds: state.totalRounds,
        phase: state.phase,
        activeSet: state.activeSet,
        activeSetOwnerIndex: state.activeSetOwnerIndex,
        lastShowerIndex: state.lastShowerIndex,
        scoutedSinceLastShow: state.scoutedSinceLastShow,
        turnInRound: state.turnInRound,
        hasActedThisRound: state.hasActedThisRound,
        players: state.players.map((p, i) => ({
          index: i,
          name: p.name,
          type: p.type,
          handSize: p.hand.length,
          collectedCount: p.collectedCards.length,
          scoutChips: p.scoutChips,
          scoutShowChipUsed: p.scoutShowChipUsed,
          totalScore: p.totalScore,
        })),
      },
    };
  }

  private getLobbySnapshot() {
    return {
      players: Array.from(this.sessions.values()).map((s) => ({
        playerIndex: s.playerIndex,
        nickname: s.nickname,
      })),
      targetPlayerCount: this.state.targetPlayerCount,
      hostSessionId: this.state.hostSessionId,
    };
  }

  private removePlayer(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.sessions.delete(sessionId);
    this.playerIndexToSession.delete(session.playerIndex);
    this.state.players.delete(sessionId);
    const idx = this.state.seatOrder.indexOf(sessionId);
    if (idx !== -1) this.state.seatOrder.splice(idx, 1);
    this.broadcast('lobbyUpdate', this.getLobbySnapshot());
  }

  private pickAvatarColor(index: number): string {
    const colors = ['primary', 'info', 'neon', 'warning', 'success'];
    return colors[index % colors.length];
  }

  /** 限流守卫：每个 session 每秒最多 10 条 action */
  private isRateLimited(sessionId: string): boolean {
    const now = Date.now();
    const entry = this.rateLimitMap.get(sessionId);
    if (!entry || now - entry.windowStart >= 1000) {
      this.rateLimitMap.set(sessionId, { count: 1, windowStart: now });
      return false;
    }
    entry.count += 1;
    if (entry.count > 10) {
      console.warn(`[GameRoom] roomId=${this.roomId} event=rateLimit sessionId=${sessionId} count=${entry.count}`);
      return true;
    }
    return false;
  }
}
