/**
 * ResultPage —— 结算页（MVP 占位版）
 *
 * 完整设计放到 Todo 6 pages-assembly 实现（彩带粒子 / 数字滚动 / 亮点卡）
 * 这个版本只给一个能看的分数清单 + 返回首页
 */
import { Home, RotateCcw, Trophy } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { ScoreNumber } from '../components/ScoreNumber';
import { cn } from '../utils/cn';

export function ResultPagePlaceholder(): JSX.Element {
  const game = useGameStore((s) => s.game);
  const goto = useGameStore((s) => s.goto);
  const restartGame = useGameStore((s) => s.restartGame);

  if (!game) {
    return (
      <div className="flex min-h-screen w-full max-w-app flex-col items-center justify-center bg-gradient-dark p-6">
        <button
          type="button"
          onClick={() => goto('start')}
          className="rounded-xl bg-gradient-neon px-6 py-3 text-white"
        >
          返回首页
        </button>
      </div>
    );
  }

  const humanIndex = game.players.findIndex((p) => p.type === 'human');
  const maxScore = Math.max(...game.players.map((p) => p.totalScore));
  const sorted = [...game.players]
    .map((p, i) => ({ ...p, idx: i }))
    .sort((a, b) => b.totalScore - a.totalScore);

  const me = humanIndex >= 0 ? game.players[humanIndex] : null;
  const humanWon = me && me.totalScore === maxScore;

  return (
    <div className="flex min-h-screen w-full max-w-app flex-col items-center justify-between gap-6 bg-gradient-dark px-6 py-8">
      {/* 胜负横幅 */}
      <div className="flex flex-col items-center gap-2 pt-6">
        <Trophy
          className={cn(
            'h-16 w-16',
            humanWon ? 'text-warning drop-shadow-[0_0_12px_rgba(245,158,11,0.6)]' : 'text-ink-400',
          )}
        />
        <h1
          className={cn(
            'text-4xl font-bold',
            humanWon ? 'text-gradient-neon' : 'text-ink-300',
          )}
        >
          {humanWon ? '胜利！' : me && me.totalScore === maxScore ? '平局' : '惜败'}
        </h1>
        <p className="text-sm text-ink-400">
          共 {game.totalRounds} 轮 · Seed {game.seed.slice(0, 8)}
        </p>
      </div>

      {/* 分数榜 */}
      <div className="flex w-full flex-col gap-2">
        {sorted.map((p, rank) => {
          const isMe = p.idx === humanIndex;
          const isWinner = p.totalScore === maxScore;
          return (
            <div
              key={p.id}
              className={cn(
                'flex items-center justify-between rounded-xl p-3',
                isMe
                  ? 'border border-accent-500/50 bg-accent-500/10'
                  : 'bg-surface-800/60',
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full font-bold',
                    isWinner
                      ? 'bg-warning/20 text-warning'
                      : 'bg-surface-700 text-ink-300',
                  )}
                >
                  {rank + 1}
                </span>
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold text-ink-50">
                    {p.name}
                    {isMe && <span className="ml-1 text-[10px] text-accent-500">（你）</span>}
                  </span>
                  <span className="text-[11px] text-ink-400">
                    credits {p.collectedCards.length + p.scoutChips}
                  </span>
                </div>
              </div>
              <ScoreNumber
                value={p.totalScore}
                showSign
                className={cn(
                  'text-2xl font-bold tabular-nums',
                  p.totalScore > 0
                    ? 'text-success'
                    : p.totalScore < 0
                      ? 'text-danger'
                      : 'text-ink-50',
                )}
              />
            </div>
          );
        })}
      </div>

      {/* 操作区 */}
      <div className="flex w-full flex-col gap-2">
        <button
          type="button"
          onClick={restartGame}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-neon py-3.5 text-sm font-bold text-white shadow-neon-primary active:scale-95"
        >
          <RotateCcw className="h-4 w-4" />
          再来一局
        </button>
        <button
          type="button"
          onClick={() => goto('start')}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-surface-800 py-3 text-sm font-semibold text-ink-300 active:scale-95"
        >
          <Home className="h-4 w-4" />
          返回首页
        </button>
      </div>
    </div>
  );
}
