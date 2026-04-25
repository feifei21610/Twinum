/**
 * StartPage —— 开始页
 *
 * 布局：
 *   - 顶部 Logo 区：Twinum 品牌文字 + 副标题
 *   - 中部卡牌视觉（3 张悬浮卡展示）
 *   - 模式选择：单机练习 / 联机对战
 *   - 底部链接：规则说明 / GitHub
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Play, BookOpen, Github, Cpu, Wifi } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { useOnlineStore } from '../store/onlineStore';
import { Card } from '../components/Card';
import type { Card as CardType } from '../types/game';

// 主视觉用的 3 张示意卡（和真实 GameState 无关）
const demoCards: CardType[] = [
  { id: 'demo-1', top: 5, bottom: 2, flipped: false },
  { id: 'demo-2', top: 8, bottom: 3, flipped: false },
  { id: 'demo-3', top: 4, bottom: 7, flipped: true },
];

export function StartPage(): JSX.Element {
  const startGame = useGameStore((s) => s.startGame);
  const goto = useGameStore((s) => s.goto);
  const savedGame = useGameStore((s) => s.game);
  const leaveOnlineRoom = useOnlineStore((s) => s.leaveRoom);
  const hasSavedGame = savedGame !== null && savedGame.phase !== 'gameEnd';
  const [playerCount, setPlayerCount] = useState<4 | 5>(4);

  const resetOnlineThen = (cb: () => void) => {
    void leaveOnlineRoom().catch(() => {
      // 忽略网络清理失败，避免阻塞单机入口
    });
    cb();
  };

  return (
    <div className="flex min-h-screen w-full max-w-app flex-col items-center justify-between gap-6 bg-gradient-dark px-6 py-10">
      {/* Logo 区 */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-center gap-2 pt-4"
      >
        <div className="glass-strong flex h-20 w-20 items-center justify-center rounded-2xl shadow-neon-primary">
          <Sparkles className="h-10 w-10 text-neon-500" />
        </div>
        <h1 className="text-gradient-neon text-5xl font-bold tracking-tight">
          Twinum
        </h1>
        <p className="text-sm text-ink-400">双数 · 致敬 Scout 的 H5 卡牌对战</p>
      </motion.div>

      {/* 主视觉：3 张悬浮卡 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.7 }}
        className="relative flex h-48 w-full items-center justify-center"
      >
        {demoCards.map((card, i) => {
          const rotations = [-12, 0, 10];
          const translates = [-60, 0, 60];
          return (
            <motion.div
              key={card.id}
              className="absolute"
              animate={{
                y: [0, -6, 0],
              }}
              transition={{
                duration: 3 + i * 0.5,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.3,
              }}
              style={{
                transform: `translateX(${translates[i]}px) rotate(${rotations[i]}deg)`,
                zIndex: i === 1 ? 2 : 1,
              }}
            >
              <Card card={card} size="lg" />
            </motion.div>
          );
        })}
      </motion.div>

      {/* 模式选择 + 链接区 */}
      <div className="flex w-full flex-col items-center gap-4">
        {hasSavedGame && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            type="button"
            onClick={() => resetOnlineThen(() => goto('game'))}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-warning/40 bg-warning/10 py-2.5 text-sm font-semibold text-warning hover:bg-warning/20 active:scale-95"
          >
            继续上一局（第 {savedGame.round} 轮）
          </motion.button>
        )}

        {/* 模式选择卡片 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="flex w-full gap-3"
        >
          {/* 单机练习卡 */}
          <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-info-400" />
              <span className="text-sm font-semibold text-ink-100">单机练习</span>
            </div>
            <p className="text-[11px] text-ink-500 leading-relaxed">和 Bot 对战，随时开局，无需网络</p>
            {/* 人数选择 */}
            <div className="flex gap-1.5">
              {([4, 5] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPlayerCount(n)}
                  className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors ${
                    playerCount === n
                      ? 'border-neon-500/60 bg-neon-500/15 text-neon-300'
                      : 'border-white/10 bg-white/5 text-ink-400 hover:text-ink-200'
                  }`}
                >
                  {n}人
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => resetOnlineThen(() => startGame({ playerCount }))}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-info-500/20 border border-info-500/30 py-2.5 text-sm font-bold text-info-300 transition-transform active:scale-95 hover:bg-info-500/30"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              开始
            </button>
          </div>

          {/* 联机对战卡 */}
          <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-neon-500/20 bg-neon-500/5 p-4">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-neon-400" />
              <span className="text-sm font-semibold text-ink-100">联机对战</span>
            </div>
            <p className="text-[11px] text-ink-500 leading-relaxed">和朋友一起玩，发链接邀请加入</p>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => goto('online')}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-neon py-2.5 text-sm font-bold text-white shadow-neon-primary transition-transform active:scale-95 hover:brightness-110"
            >
              <Wifi className="h-3.5 w-3.5" />
              进入
            </button>
          </div>
        </motion.div>

        <div className="flex w-full items-center justify-around text-xs text-ink-400">
          <button
            type="button"
            onClick={() => goto('rules')}
            className="flex items-center gap-1.5 hover:text-ink-50"
          >
            <BookOpen className="h-3.5 w-3.5" />
            规则说明
          </button>
          <a
            href="https://github.com/feifei21610/twinum"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-ink-50"
          >
            <Github className="h-3.5 w-3.5" />
            GitHub
          </a>
        </div>

        <p className="mt-2 text-center text-[10px] text-ink-400/60">
          致敬 Oink Games《SCOUT!》· 个人学习作品 · 非商业项目
        </p>
      </div>
    </div>
  );
}
