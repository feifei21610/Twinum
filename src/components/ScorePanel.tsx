/**
 * ScorePanel —— 顶部状态条
 *
 * 展示：
 *   - 当前轮次（第 N 轮 / 共 M 轮）
 *   - 玩家自己当前累计分数
 *   - 返回首页 / 日志抽屉 / 重开按钮
 */
import { Home, RotateCcw, Scroll } from 'lucide-react';
import type { GameState } from '../types/game';
import { cn } from '../utils/cn';

export interface ScorePanelProps {
  game: GameState;
  humanPlayerIndex: number;
  /** 当前日志条数（用于红点提示） */
  logCount: number;
  /** 日志抽屉是否打开（用于按钮高亮） */
  logOpen: boolean;
  onGoHome: () => void;
  onRestart: () => void;
  onToggleLog: () => void;
  className?: string;
}

export function ScorePanel({
  game,
  humanPlayerIndex,
  logCount,
  logOpen,
  onGoHome,
  onRestart,
  onToggleLog,
  className,
}: ScorePanelProps): JSX.Element {
  const me = game.players[humanPlayerIndex];

  return (
    <div
      className={cn(
        'flex w-full items-center justify-between border-b border-white/5 bg-surface-900/80 px-3 py-2 backdrop-blur-md',
        className,
      )}
    >
      {/* 左侧：返回 + 轮次 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onGoHome}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-800 text-ink-300 hover:bg-surface-700 hover:text-ink-50"
          aria-label="返回首页"
        >
          <Home className="h-4 w-4" />
        </button>
        <div className="flex flex-col text-xs leading-tight">
          <span className="font-semibold text-ink-50">
            第 {game.round} / {game.totalRounds} 轮
          </span>
          <span className="text-[10px] text-ink-400">Seed {game.seed.slice(0, 6)}</span>
        </div>
      </div>

      {/* 右侧：我的分数 + 日志 + 重开 */}
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-end text-xs leading-tight">
          <span className="text-[10px] text-ink-400">我的累计</span>
          <span
            className={cn(
              'text-base font-bold',
              me.totalScore > 0
                ? 'text-success'
                : me.totalScore < 0
                  ? 'text-danger'
                  : 'text-ink-50',
            )}
          >
            {me.totalScore > 0 ? `+${me.totalScore}` : me.totalScore}
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleLog}
          className={cn(
            'relative flex h-8 w-8 items-center justify-center rounded-full transition-colors',
            logOpen
              ? 'bg-neon-500/30 text-neon-200 ring-1 ring-neon-400/50'
              : 'bg-surface-800 text-ink-300 hover:bg-surface-700 hover:text-ink-50',
          )}
          aria-label={logOpen ? '收起对局记录' : '打开对局记录'}
        >
          <Scroll className="h-4 w-4" />
          {logCount > 0 && !logOpen && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-neon-500 px-1 text-[9px] font-bold leading-none text-white">
              {logCount > 99 ? '99' : logCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-800 text-ink-300 hover:bg-surface-700 hover:text-ink-50"
          aria-label="重开"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
