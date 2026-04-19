/**
 * OpponentArea —— 对手信息区
 *
 * 在 4 人局里，顶部横排 3 个对手。每个对手展示：
 *   - 头像（颜色由 avatarColor 决定）
 *   - 名字 + 分数
 *   - 手牌张数（用 mini 卡背堆叠指示）
 *   - Scout Chip 数（图标 + 数字）
 *   - Scout&Show Chip 状态（已用置灰）
 *   - 当前回合高亮（脉冲光晕 + 呼吸）
 *
 * 紧凑设计：每个对手 block 宽度 ~33%，不占太多空间（核心画面留给 Board 和 Hand）
 */
import { motion } from 'framer-motion';
import { Coins, Zap, Layers } from 'lucide-react';
import type { Player } from '../types/game';
import { BotThinking } from './BotThinking';
import { cn } from '../utils/cn';

export interface OpponentAreaProps {
  opponents: Player[];
  currentPlayerIndex: number;
  lastShowerIndex: number | null;
  botThinking: boolean;
  /** 全局玩家 index 映射：opponents[i] 在 game.players 里的 index */
  opponentGlobalIndexes: number[];
  className?: string;
}

const avatarColorMap: Record<string, string> = {
  info: 'from-info to-cyan-600',
  neon: 'from-accent-500 to-neon-500',
  warning: 'from-amber-500 to-warning',
  success: 'from-success to-emerald-600',
  primary: 'from-primary-500 to-primary-700',
};

function OpponentCard({
  player,
  isCurrent,
  isLastShower,
  botThinking,
}: {
  player: Player;
  isCurrent: boolean;
  isLastShower: boolean;
  botThinking: boolean;
}): JSX.Element {
  const handCount = player.hand.length;
  const gradient = avatarColorMap[player.avatarColor] ?? avatarColorMap.info;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative flex flex-col items-center gap-1.5 rounded-xl p-2 transition-all',
        isCurrent
          ? 'bg-accent-500/10 ring-2 ring-accent-500/50 shadow-neon-accent'
          : 'bg-surface-800/40',
      )}
    >
      {/* 当前回合光晕 */}
      {isCurrent && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-xl"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            boxShadow: 'inset 0 0 16px rgba(139, 92, 246, 0.4)',
          }}
        />
      )}

      {/* Bot 思考气泡 */}
      {isCurrent && botThinking && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2">
          <BotThinking />
        </div>
      )}

      {/* 头像 */}
      <div
        className={cn(
          'relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br shadow-md',
          gradient,
        )}
      >
        <span className="text-sm font-bold text-white">
          {player.name.slice(-1).toUpperCase()}
        </span>
        {/* lastShower 标记（👑 角标） */}
        {isLastShower && (
          <span className="absolute -right-1 -top-1 text-xs drop-shadow-[0_0_4px_rgba(236,72,153,0.8)]">
            👑
          </span>
        )}
      </div>

      {/* 名字 + 分数 */}
      <div className="text-center leading-tight">
        <div className="text-[11px] font-semibold text-ink-50">{player.name}</div>
        <div className="text-[10px] text-ink-400">
          {player.totalScore} 分
        </div>
      </div>

      {/* 三行信息（带中文标签，一眼能懂） */}
      <div className="flex w-full flex-col gap-0.5 px-1 text-[10px] leading-tight">
        {/* 手牌 */}
        <div
          className="flex items-center justify-between text-ink-300"
          title="剩余手牌数"
        >
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3 text-info" />
            手牌
          </span>
          <span className="font-semibold text-ink-100">{handCount}</span>
        </div>

        {/* Credits = 已收集 + Scout Chip，合并展示 */}
        <div
          className="flex items-center justify-between text-ink-300"
          title="Credits = 已收集翻面牌数 + Scout Chip 数，每个计 1 分"
        >
          <span className="flex items-center gap-1">
            <Coins className="h-3 w-3 text-warning" />
            credits
          </span>
          <span className="font-semibold text-ink-100">
            {player.collectedCards.length + player.scoutChips}
          </span>
        </div>

        {/* S&S 特权 */}
        <div
          className={cn(
            'flex items-center justify-between',
            player.scoutShowChipUsed ? 'text-ink-500' : 'text-ink-300',
          )}
          title="S&S（Scout & Show）· 每轮限用 1 次"
        >
          <span className="flex items-center gap-1">
            <Zap
              className={cn(
                'h-3 w-3',
                player.scoutShowChipUsed ? 'text-ink-500' : 'text-neon-400',
              )}
            />
            S&S
          </span>
          <span
            className={cn(
              'font-semibold',
              player.scoutShowChipUsed ? 'text-ink-500' : 'text-neon-300',
            )}
          >
            {player.scoutShowChipUsed ? '已用' : '可用'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export function OpponentArea({
  opponents,
  currentPlayerIndex,
  lastShowerIndex,
  botThinking,
  opponentGlobalIndexes,
  className,
}: OpponentAreaProps): JSX.Element {
  return (
    <div className={cn('grid grid-cols-3 gap-2 px-3', className)}>
      {opponents.map((opp, i) => {
        const globalIdx = opponentGlobalIndexes[i];
        return (
          <OpponentCard
            key={opp.id}
            player={opp}
            isCurrent={globalIdx === currentPlayerIndex}
            isLastShower={globalIdx === lastShowerIndex}
            botThinking={botThinking}
          />
        );
      })}
    </div>
  );
}
