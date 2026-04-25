/**
 * GameLogDrawer —— 对局日志侧边抽屉（非阻塞版）
 *
 * 设计原则：打开时牌局必须仍可正常操作。所以：
 *   - 去掉背景遮罩（不拦截点击）
 *   - 抽屉本身宽度收窄（桌面 280px / 移动 72vw）
 *   - 外层 fixed 容器 pointer-events:none，只有 <aside> 自身 pointer-events:auto
 *     → 外层不会拦截到牌局区域的点击
 *   - 关闭方式：抽屉内的 X 按钮（或再次点击顶部日志图标 toggle）
 *
 * 内容：展示最近 2 轮（当前轮 + 上一轮），按轮分组；当前轮默认展开，上一轮默认折叠。
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useMemo, useState } from 'react';
import { X, Scroll, ChevronDown, ChevronRight } from 'lucide-react';
import type { GameLogEntry } from '../utils/game-log';
import type { Action } from '../types/game';
import { cn } from '../utils/cn';

export interface GameLogDrawerProps {
  open: boolean;
  log: GameLogEntry[];
  /** 当前轮次（用于标题 + 分组） */
  currentRound: number;
  onClose: () => void;
}

const actionKindLabel: Record<Action['type'], { label: string; colorClass: string }> = {
  SHOW: { label: 'Show', colorClass: 'bg-gradient-neon text-white' },
  SCOUT: { label: 'Scout', colorClass: 'bg-surface-600 text-ink-50' },
  SCOUT_AND_SHOW: { label: 'S&S', colorClass: 'bg-neon-500/90 text-white' },
  FLIP_HAND: { label: 'Flip', colorClass: 'bg-warning/80 text-white' },
};

export function GameLogDrawer({
  open,
  log,
  currentRound,
  onClose,
}: GameLogDrawerProps): JSX.Element {
  // 按轮分组，最新轮在前
  const grouped = useMemo(() => {
    const byRound = new Map<number, GameLogEntry[]>();
    for (const e of log) {
      const arr = byRound.get(e.round) ?? [];
      arr.push(e);
      byRound.set(e.round, arr);
    }
    // 只取最近 2 轮（理论上 store 已经过滤，这里兜底）
    const rounds = [...byRound.keys()].sort((a, b) => b - a).slice(0, 2);
    return rounds.map((r) => ({ round: r, entries: byRound.get(r)! }));
  }, [log]);

  // 默认当前轮展开，其他折叠
  const [collapsedRounds, setCollapsedRounds] = useState<Set<number>>(new Set());
  const toggleRound = (round: number) => {
    setCollapsedRounds((prev) => {
      const next = new Set(prev);
      if (next.has(round)) next.delete(round);
      else next.add(round);
      return next;
    });
  };

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40"
      aria-hidden={!open}
    >
      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className={cn(
              // 只有抽屉本身拦截点击，外层 pointer-events-none 让牌局可点
              'pointer-events-auto',
              'absolute right-0 top-0 flex h-full flex-col',
              'w-[72vw] max-w-[280px]',
              'border-l border-white/10 bg-surface-800/95 shadow-2xl backdrop-blur-lg',
            )}
          >
            {/* 顶部标题栏 */}
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Scroll className="h-4 w-4 text-neon-400" />
                <h2 className="text-xs font-bold text-ink-50">对局记录</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-700 text-ink-300 hover:bg-surface-600 hover:text-ink-50"
                aria-label="关闭"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* 日志列表（按轮分组） */}
            <div className="flex-1 overflow-y-auto">
              {grouped.length === 0 ? (
                <div className="flex h-full items-center justify-center px-4 text-center text-xs text-ink-400">
                  尚未有动作
                </div>
              ) : (
                <div className="space-y-1">
                  {grouped.map(({ round, entries }) => {
                    const isCurrent = round === currentRound;
                    // 默认当前轮展开；其他（上一轮）也默认展开，除非用户手动折叠了
                    const collapsed = collapsedRounds.has(round);
                    // 按时间倒序（最新在上）
                    const sortedEntries = [...entries].reverse();
                    return (
                      <section key={round}>
                        <button
                          type="button"
                          onClick={() => toggleRound(round)}
                          className={cn(
                            'sticky top-0 z-10 flex w-full items-center justify-between gap-2 px-3 py-1.5',
                            'bg-surface-800/95 backdrop-blur',
                            'text-[11px] font-bold uppercase tracking-wide',
                            isCurrent ? 'text-neon-400' : 'text-ink-300',
                            'hover:bg-surface-700/60',
                          )}
                        >
                          <span className="flex items-center gap-1.5">
                            {collapsed ? (
                              <ChevronRight className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                            第 {round} 轮
                            {isCurrent && (
                              <span className="rounded bg-neon-500/20 px-1 py-0.5 text-[9px] text-neon-300">
                                进行中
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] font-normal text-ink-400">
                            {entries.length} 步
                          </span>
                        </button>
                        {!collapsed && (
                          <ul className="space-y-1 px-2 pb-2 pt-1">
                            {sortedEntries.map((entry, i) => {
                              const isLatest = isCurrent && i === 0;
                              const tag = actionKindLabel[entry.actionKind];
                              return (
                                <motion.li
                                  key={`${entry.timestamp}-${entry.round}-${entry.turnInRound}`}
                                  initial={isLatest ? { opacity: 0, x: 10 } : false}
                                  animate={{ opacity: 1, x: 0 }}
                                  className={cn(
                                    'flex items-start gap-1.5 rounded-md px-2 py-1.5 text-[11px] leading-tight',
                                    isLatest
                                      ? 'bg-accent-500/10 ring-1 ring-accent-500/30'
                                      : 'bg-surface-900/40',
                                  )}
                                >
                                  <span className="mt-0.5 min-w-[1.6rem] font-mono text-[9px] text-ink-400">
                                    T{entry.turnInRound}
                                  </span>
                                  <span
                                    className={cn(
                                      'flex-shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase',
                                      tag.colorClass,
                                    )}
                                  >
                                    {tag.label}
                                  </span>
                                  <span
                                    className={cn(
                                      'flex-1 break-words',
                                      entry.isHuman ? 'text-primary-400' : 'text-ink-50',
                                    )}
                                  >
                                    {entry.text}
                                  </span>
                                </motion.li>
                              );
                            })}
                          </ul>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 底部提示 */}
            <div className="border-t border-white/5 px-3 py-1.5 text-[10px] text-ink-400/70">
              最近 2 轮 · 共 {log.length} 条
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
