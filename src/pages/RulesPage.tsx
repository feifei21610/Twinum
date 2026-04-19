/**
 * RulesPage —— 规则说明页
 */
import { useState } from 'react';
import { ChevronLeft, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { Card } from '../components/Card';
import type { Card as CardType } from '../types/game';

// ── 数据 ──────────────────────────────────────────────────────

const rule1Groups: { cards: CardType[] }[] = [
  {
    cards: [
      { id: 'r1-1', top: 1, bottom: 8, flipped: false },
      { id: 'r1-2', top: 2, bottom: 7, flipped: false },
      { id: 'r1-3', top: 3, bottom: 6, flipped: false },
    ],
  },
  {
    cards: [
      { id: 'r2-1', top: 4, bottom: 5, flipped: false },
      { id: 'r2-2', top: 4, bottom: 3, flipped: false },
    ],
  },
  {
    cards: [
      { id: 'r3-1', top: 5, bottom: 4, flipped: false },
      { id: 'r3-2', top: 6, bottom: 3, flipped: false },
    ],
  },
  {
    cards: [{ id: 'r4-1', top: 7, bottom: 2, flipped: false }],
  },
];

const rule2Actions = [
  {
    label: 'Show',
    desc: '出一组相邻手牌（同数字或连续数字），必须能盖过场上当前牌组才能出。第一家随意出。',
  },
  {
    label: 'Scout',
    desc: '从场上牌组左端或右端抽一张，可选翻面，插入手牌任意位置。原主人得 1 分。',
  },
  {
    label: 'S&S',
    desc: '先 Scout 一张再立即出牌。每人每轮仅限 1 次，用完置灰。',
  },
];

// ── 快速规则卡 ────────────────────────────────────────────────

function QuickRulesCard(): JSX.Element {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="glass overflow-hidden rounded-2xl border border-white/10">
      {/* 标题行 */}
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="quick-rules-panel"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <span className="flex-1 text-sm font-bold text-ink-50">⚡ 快速规则</span>
        <span className="text-[11px] text-ink-400">30 秒看懂核心玩法</span>
        <motion.span
          animate={{ rotate: expanded ? 0 : -180 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="ml-1 text-ink-400"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id="quick-rules-panel"
            key="quick-rules-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-5 border-t border-white/5 px-4 pb-5 pt-4">

              {/* 目标 */}
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-400">
                  🎯 目标
                </p>
                <p className="text-xs leading-relaxed text-ink-300">
                  4 人局打 4 轮，每轮结算：credits（收集翻面牌数 + Scout 分）−
                  剩余手牌数。总分最高者获胜。
                </p>
              </div>

              {/* RULE 1 牌组强度 */}
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-400">
                  🃏 牌组强度
                </p>
                <div className="flex items-center justify-center gap-1.5 overflow-x-auto pb-1">
                  {rule1Groups.map((grp, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <div className="flex items-end gap-0.5">
                        {grp.cards.map((c) => (
                          <Card key={c.id} card={c} size="xs" disabled />
                        ))}
                      </div>
                      {i < rule1Groups.length - 1 && (
                        <span className="shrink-0 text-sm font-bold text-ink-300">›</span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-center text-[10px] text-ink-400">
                  长组 › 短组 · 相同 › 连续 · 最小值大者胜
                </p>
              </div>

              {/* RULE 2 每回合动作 */}
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-400">
                  🔀 每回合三选一
                </p>
                <div className="space-y-2.5">
                  {rule2Actions.map(({ label, desc }) => (
                    <div key={label} className="flex gap-2.5">
                      <span className="mt-0.5 shrink-0 rounded-full border border-white/20 px-2.5 py-0.5 font-mono text-[11px] text-ink-200">
                        {label}
                      </span>
                      <span className="text-xs leading-relaxed text-ink-300">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 整副翻转 */}
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-400">
                  🔁 整副翻转
                </p>
                <p className="text-xs leading-relaxed text-ink-300">
                  每轮开始、尚未行动前，可将整副手牌翻面（正反互换）。每轮限用一次。
                </p>
              </div>

              {/* 回合结束 */}
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-400">
                  🏁 回合结束
                </p>
                <p className="text-xs leading-relaxed text-ink-300">
                  ① 有人出完所有手牌；或 ② Show 后其余玩家均只 Scout 轮回到 Show 者。
                  第 ② 种情况的 Show 者免扣剩余手牌分。
                </p>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 页面主体 ──────────────────────────────────────────────────

export function RulesPagePlaceholder(): JSX.Element {
  const goto = useGameStore((s) => s.goto);

  return (
    <div className="flex min-h-screen w-full max-w-app flex-col bg-gradient-dark">
      {/* 顶部返回栏 */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-white/5 bg-surface-900/80 px-3 py-2.5 backdrop-blur-md">
        <button
          type="button"
          onClick={() => goto('start')}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-800 text-ink-300 hover:text-ink-50"
          aria-label="返回"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h1 className="text-sm font-bold text-ink-50">规则说明</h1>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <QuickRulesCard />
      </div>

      {/* 底部确认按钮 */}
      <div className="border-t border-white/5 bg-surface-900/80 px-4 py-3 backdrop-blur-md">
        <button
          type="button"
          onClick={() => goto('start')}
          className="w-full rounded-xl bg-gradient-neon py-3 text-sm font-bold text-white shadow-neon-primary active:scale-95"
        >
          知道了
        </button>
      </div>
    </div>
  );
}
