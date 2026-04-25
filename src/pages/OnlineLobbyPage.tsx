/**
 * OnlineLobbyPage — 联机大厅
 *
 * 两种状态：
 * 1. 创建/加入房间前（填昵称、选人数、输入房间号）
 * 2. 等待室（显示已加入的玩家、分享链接、开始按钮）
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Copy, Check, Play, ArrowLeft, Wifi, WifiOff } from 'lucide-react';
import { useOnlineStore, type OnlineStore } from '../store/onlineStore';
import { useGameStore } from '../store/gameStore';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'ws://localhost:2567';

export function OnlineLobbyPage(): JSX.Element {
  const {
    phase, errorMessage, myPlayerIndex, myNickname, roomId, isHost,
    lobby, targetPlayerCount, targetRounds,
    init, createRoom, joinRoom, startGame, leaveRoom, setNickname, setTargetPlayerCount, setTargetRounds,
  } = useOnlineStore();

  const goto = useGameStore((s) => s.goto);

  const [nickname, setNicknameLocal] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [isLoading, setIsLoading] = useState(false);

  // 初始化网络客户端
  useEffect(() => {
    init(SERVER_URL);
    const params = new URLSearchParams(window.location.search);
    const urlRoomId = params.get('room');

    // 先看本地有没有未结束的重连 token
    const savedToken = localStorage.getItem('twinum_reconnection_token');
    const savedRoomId = localStorage.getItem('twinum_room_id');
    if (savedToken && savedRoomId && (!urlRoomId || urlRoomId === savedRoomId)) {
      // 静默尝试重连，失败就清 token 回大厅
      useOnlineStore.getState().reconnect().catch(() => {
        localStorage.removeItem('twinum_reconnection_token');
        localStorage.removeItem('twinum_room_id');
      });
      return;
    }

    if (urlRoomId) {
      setRoomIdInput(urlRoomId);
      setTab('join');
    }
  }, [init]);

  // 游戏开始后跳转到游戏页
  useEffect(() => {
    if (phase === 'playing') {
      goto('game');
    }
  }, [phase, goto]);

  const handleCreate = async () => {
    const name = nickname.trim() || '玩家1';
    setNickname(name);
    setIsLoading(true);
    try {
      const url = await createRoom(name, targetPlayerCount, targetRounds);
      setShareUrl(url);
    } catch {
      // errorMessage 会在 store 里被设置
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    const name = nickname.trim() || '访客';
    const rid = roomIdInput.trim();
    if (!rid) return;
    setNickname(name);
    setIsLoading(true);
    try {
      await joinRoom(rid, name);
    } catch {
      // errorMessage 会在 store 里被设置
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBack = async () => {
    await leaveRoom();
    goto('start');
  };

  // 等待室状态
  if (phase === 'lobby') {
    return <WaitingRoom
      roomId={roomId ?? ''}
      shareUrl={shareUrl}
      lobby={lobby}
      isHost={isHost}
      myPlayerIndex={myPlayerIndex ?? 0}
      targetPlayerCount={targetPlayerCount}
      targetRounds={targetRounds}
      onStart={startGame}
      onBack={handleBack}
      copied={copied}
      onCopy={handleCopyLink}
    />;
  }

  // 填表阶段
  return (
    <div className="flex min-h-screen w-full max-w-app flex-col bg-gradient-dark px-6 py-10">
      {/* 顶部 */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => goto('start')}
          className="rounded-xl p-2 text-ink-400 hover:bg-white/10 hover:text-ink-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-ink-100">联机对战</h1>
      </div>

      {/* Tab 切换 */}
      <div className="mb-6 flex gap-2 rounded-xl bg-white/5 p-1">
        {(['create', 'join'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              tab === t
                ? 'bg-neon-500/20 text-neon-300'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            {t === 'create' ? '创建房间' : '加入房间'}
          </button>
        ))}
      </div>

      {/* 昵称输入（共用） */}
      <div className="mb-4">
        <label className="mb-1.5 block text-xs text-ink-400">你的昵称</label>
        <input
          type="text"
          maxLength={12}
          placeholder="随便起个名字"
          value={nickname}
          onChange={(e) => setNicknameLocal(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-neon-500/50"
        />
      </div>

      <AnimatePresence mode="wait">
        {tab === 'create' ? (
          <motion.div
            key="create"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex flex-col gap-4"
          >
            {/* 人数选择 */}
            <div>
              <label className="mb-1.5 block text-xs text-ink-400">房间人数（空位补 Bot）</label>
              <div className="flex gap-2">
                {([3, 4, 5] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setTargetPlayerCount(n);
                      // 人数改变时，若当前轮数等于旧人数（默认值），同步更新为新人数
                      if (targetRounds === targetPlayerCount) setTargetRounds(n);
                    }}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                      targetPlayerCount === n
                        ? 'border-neon-500/60 bg-neon-500/15 text-neon-300'
                        : 'border-white/10 bg-white/5 text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    {n}人
                  </button>
                ))}
              </div>
            </div>

            {/* 轮数选择 */}
            <div>
              <label className="mb-1.5 block text-xs text-ink-400">
                对局轮数
                <span className="ml-1.5 text-ink-500">（默认 {targetPlayerCount} 人 {targetPlayerCount} 轮）</span>
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTargetRounds(n)}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                      targetRounds === n
                        ? 'border-neon-500/60 bg-neon-500/15 text-neon-300'
                        : 'border-white/10 bg-white/5 text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    {n}轮
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={isLoading}
              onClick={handleCreate}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-neon py-4 text-base font-bold text-white shadow-neon-primary transition-transform active:scale-95 hover:brightness-110 disabled:opacity-60"
            >
              <Users className="h-5 w-5" />
              {isLoading ? '创建中…' : '创建房间'}
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="join"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex flex-col gap-4"
          >
            <div>
              <label className="mb-1.5 block text-xs text-ink-400">房间 ID</label>
              <input
                type="text"
                placeholder="粘贴房间 ID 或链接"
                value={roomIdInput}
                onChange={(e) => {
                  // 支持粘贴完整链接：自动提取 room= 参数
                  const val = e.target.value;
                  const match = val.match(/[?&]room=([^&]+)/);
                  setRoomIdInput(match ? match[1] : val);
                }}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink-100 font-mono outline-none placeholder:text-ink-500 focus:border-neon-500/50"
              />
            </div>

            <button
              type="button"
              disabled={isLoading || !roomIdInput.trim()}
              onClick={handleJoin}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-neon py-4 text-base font-bold text-white shadow-neon-primary transition-transform active:scale-95 hover:brightness-110 disabled:opacity-60"
            >
              <Play className="h-5 w-5 fill-current" />
              {isLoading ? '加入中…' : '加入房间'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 错误提示 */}
      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {errorMessage}
        </motion.div>
      )}

      {/* 服务器连接提示 */}
      <p className="mt-6 text-center text-[10px] text-ink-500">
        服务器：{SERVER_URL}
      </p>
    </div>
  );
}

// ===== 等待室组件 =====

interface WaitingRoomProps {
  roomId: string;
  shareUrl: string;
  lobby: OnlineStore['lobby'];
  isHost: boolean;
  myPlayerIndex: number;
  targetPlayerCount: number;
  targetRounds: number;
  onStart: () => void;
  onBack: () => void;
  copied: boolean;
  onCopy: () => void;
}

function WaitingRoom({
  roomId, shareUrl, lobby, isHost, myPlayerIndex, targetPlayerCount, targetRounds,
  onStart, onBack, copied, onCopy,
}: WaitingRoomProps): JSX.Element {
  const currentCount = lobby?.players.length ?? 0;
  const botCount = targetPlayerCount - currentCount;

  return (
    <div className="flex min-h-screen w-full max-w-app flex-col bg-gradient-dark px-6 py-10">
      {/* 顶部 */}
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl p-2 text-ink-400 hover:bg-white/10 hover:text-ink-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <h1 className="text-sm font-bold text-ink-100">等待玩家加入</h1>
          <p className="text-[10px] text-ink-500 font-mono">{roomId} · {targetRounds} 轮</p>
        </div>
        <div className="w-9" />
      </div>

      {/* 分享链接 */}
      {shareUrl && (
        <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="mb-2 text-xs text-ink-400">分享链接给朋友</p>
          <div className="flex gap-2">
            <p className="flex-1 truncate rounded-lg bg-white/5 px-3 py-2 text-xs text-ink-300 font-mono">
              {shareUrl}
            </p>
            <button
              type="button"
              onClick={onCopy}
              className="flex items-center gap-1.5 rounded-lg border border-neon-500/30 bg-neon-500/10 px-3 py-2 text-xs text-neon-300 hover:bg-neon-500/20"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? '已复制' : '复制'}
            </button>
          </div>
        </div>
      )}

      {/* 玩家列表 */}
      <div className="mb-6 flex flex-col gap-2">
        <p className="text-xs text-ink-400">
          玩家 {currentCount}/{targetPlayerCount}
          {botCount > 0 && `（${botCount} 个空位将由 Bot 补满）`}
        </p>

        {(lobby?.players ?? []).map((p: { playerIndex: number; nickname: string }) => (
          <motion.div
            key={p.playerIndex}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
          >
            <Wifi className="h-4 w-4 text-neon-400" />
            <span className="flex-1 text-sm text-ink-100">{p.nickname}</span>
            {p.playerIndex === myPlayerIndex && (
              <span className="text-[10px] text-neon-400">（你）</span>
            )}
            {p.playerIndex === 0 && (
              <span className="text-[10px] text-ink-500">房主</span>
            )}
          </motion.div>
        ))}

        {/* Bot 占位席 */}
        {Array.from({ length: botCount }).map((_, i) => (
          <div
            key={`bot-${i}`}
            className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
          >
            <WifiOff className="h-4 w-4 text-ink-500" />
            <span className="flex-1 text-sm text-ink-500">等待玩家加入… (Bot 将补位)</span>
          </div>
        ))}
      </div>

      {/* 开始按钮（仅房主） */}
      {isHost ? (
        <button
          type="button"
          onClick={onStart}
          disabled={currentCount < 1}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-neon py-4 text-base font-bold text-white shadow-neon-primary transition-transform active:scale-95 hover:brightness-110 disabled:opacity-40"
        >
          <Play className="h-5 w-5 fill-current" />
          开始游戏
        </button>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 py-4 text-center text-sm text-ink-400">
          等待房主开始…
        </div>
      )}
    </div>
  );
}
