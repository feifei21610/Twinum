/**
 * BoardArea —— 场上信息区
 *
 * 展示：
 *   - 当前 Active Set（居中；若为空显示"场上无牌"状态）
 *   - Active Set 的 owner 名字
 *   - 左右两端的"Scout 抽牌提示"（脉冲光边）
 *   - 牌组类型 + 最小数字标签
 */
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import type { CardGroup, Player } from '../types/game';
import { Card } from './Card';
import { cn } from '../utils/cn';

export interface BoardAreaProps {
  activeSet: CardGroup | null;
  ownerName: string | null;
  /** Scout 可从左端抽（UI 上显示脉冲） */
  canScoutLeft: boolean;
  /** Scout 可从右端抽 */
  canScoutRight: boolean;
  /** 当前玩家（用于信息栏） */
  currentPlayer: Player | null;
  /** 是否显示"你的回合"提示（轮到人类时 true） */
  isHumanTurn: boolean;
  className?: string;
}

export function BoardArea({
  activeSet,
  ownerName,
  canScoutLeft,
  canScoutRight,
  currentPlayer,
  isHumanTurn,
  className,
}: BoardAreaProps): JSX.Element {
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center gap-2 px-4 py-6',
        'min-h-[160px]',
        className,
      )}
    >
      {/* 回合提示 */}
      <div className="flex items-center gap-2 text-xs">
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 font-semibold',
            isHumanTurn
              ? 'bg-gradient-neon text-white shadow-neon-primary'
              : 'bg-surface-800 text-ink-300',
          )}
        >
          {isHumanTurn ? '你的回合' : `${currentPlayer?.name ?? '...'} 的回合`}
        </span>
      </div>

      {/* Active Set 区 */}
      <AnimatePresence mode="wait">
        {activeSet ? (
          <motion.div
            key={`active-${activeSet.cards.map((c) => c.id).join('-')}`}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-1.5"
          >
            {/* 类型标签 */}
            <div className="flex items-center gap-2 text-[11px]">
              <span className="rounded-full bg-accent-500/20 px-2 py-0.5 font-medium text-accent-500">
                {activeSet.kind === 'same' ? '同数组' : '连续组'}
              </span>
              <span className="rounded-full bg-surface-800 px-2 py-0.5 font-medium text-ink-300">
                min={activeSet.minValue}
              </span>
              {ownerName && (
                <span className="text-ink-400">来自 {ownerName}</span>
              )}
            </div>

            {/* 卡牌 + 左右 Scout 提示 */}
            <div className="flex items-center gap-2">
              {canScoutLeft && (
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="flex flex-col items-center gap-0.5"
                  title="Scout 可从左端抽这张"
                >
                  <ArrowLeft className="h-4 w-4 text-neon-400" />
                  <span className="text-[9px] text-neon-400">抽</span>
                </motion.div>
              )}

              <div className="flex gap-1">
                {activeSet.cards.map((card) => (
                  <Card key={card.id} card={card} size="md" />
                ))}
              </div>

              {canScoutRight && (
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="flex flex-col items-center gap-0.5"
                  title="Scout 可从右端抽这张"
                >
                  <ArrowRight className="h-4 w-4 text-neon-400" />
                  <span className="text-[9px] text-neon-400">抽</span>
                </motion.div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty-board"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-1.5 text-ink-400"
          >
            <Sparkles className="h-5 w-5 text-accent-500/60" />
            <span className="text-xs">场上无牌 · 谁打出都 OK</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
