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

              {/* 0. 游戏介绍 */}
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-400">
                  🎮 游戏介绍
                </p>
                <p className="text-xs leading-relaxed text-ink-300">
                  Twinum 是一款<b className="text-ink-100">轮流出牌</b>的策略游戏。每张牌有
                  <b className="text-ink-100">正面和背面两个数字</b>，玩家同一时间只能选择手牌中的
                  <b className="text-ink-100">其中一个数字</b>使用，在出牌与抢牌之间反复博弈，
                  最终以<b className="text-ink-100">多轮积分</b>决出胜者。
                </p>
              </div>

              {/* 1. 目标 */}
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-400">
                  🎯 目标
                </p>
                <p className="text-xs leading-relaxed text-ink-300">
                  4 人一局，共打 <b className="text-ink-100">4 轮</b>。每轮独立结算得分，
                  <b className="text-ink-100">4 轮总分最高者获胜</b>。
                </p>
              </div>

              {/* 2. 玩法流程 */}
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-400">
                  🔀 玩法流程（操作 / 回合结束 / 计分）
                </p>

                {/* 2-① 每回合三选一 */}
                <p className="mb-1.5 text-xs font-semibold text-ink-200">① 每回合三选一</p>
                <div className="space-y-3">

                  {/* Show */}
                  <div>
                    <div className="flex gap-2.5">
                      <span className="inline-flex items-center shrink-0 rounded-full border border-white/20 px-2.5 py-0.5 font-mono text-[11px] text-ink-200">
                        Show（出牌）
                      </span>
                      <span className="text-xs leading-relaxed text-ink-300">
                        出一组相邻手牌（同数字或连续数字），必须能盖过场上当前牌组。第一家可随意出。
                      </span>
                    </div>
                    {/* 牌组强度子项 */}
                    <div className="ml-2 mt-2 rounded-lg bg-white/5 px-3 py-2">
                      <p className="mb-1 text-[11px] font-semibold text-ink-300">
                        牌组强度比较顺序：
                      </p>
                      <ul className="space-y-0.5 text-xs leading-relaxed text-ink-400">
                        <li><span className="mr-1 font-bold text-ink-200">①</span> 牌数多的更强（3 张 &gt; 2 张 &gt; 1 张）；</li>
                        <li><span className="mr-1 font-bold text-ink-200">②</span> 同牌数时，<b className="text-ink-300">同数字</b> 强于 <b className="text-ink-300">连续数字</b>；</li>
                        <li><span className="mr-1 font-bold text-ink-200">③</span> 再相同时，<b className="text-ink-300">最小数字更大</b>者胜。</li>
                      </ul>
                      <div className="mt-2 flex items-center justify-center gap-1">
                        {rule1Groups.map((grp, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <div className="flex items-end gap-0.5">
                              {grp.cards.map((c) => (
                                <Card key={c.id} card={c} size="xxs" disabled />
                              ))}
                            </div>
                            {i < rule1Groups.length - 1 && (
                              <span className="shrink-0 text-sm font-bold text-ink-300">›</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Scout */}
                  <div className="flex gap-2.5">
                    <span className="inline-flex items-center shrink-0 rounded-full border border-white/20 px-2.5 py-0.5 font-mono text-[11px] text-ink-200">
                      Scout（抽牌）
                    </span>
                    <span className="text-xs leading-relaxed text-ink-300">
                      从场上牌组的左端或右端抽走 1 张，可选翻面后插入自己手牌任意位置。
                    </span>
                  </div>

                  {/* S&S */}
                  <div className="flex gap-2.5">
                    <span className="inline-flex items-center shrink-0 rounded-full border border-white/20 px-2.5 py-0.5 font-mono text-[11px] text-ink-200">
                      S&S（先抽后出）
                    </span>
                    <span className="text-xs leading-relaxed text-ink-300">
                      先 Scout 一张，再立即 Show 一次。每人每轮限用 1 次。
                    </span>
                  </div>

                </div>

                {/* 2-② 边玩边计分 */}
                <p className="mb-1.5 mt-4 text-xs font-semibold text-ink-200">② 边玩边计分（伴随操作实时发生）</p>
                <div className="space-y-2.5">
                  <div className="flex gap-2.5">
                    <span className="inline-flex items-center shrink-0 rounded-full border border-white/20 px-2 py-0.5 font-mono text-[11px] text-ink-200">
                      + 收牌
                    </span>
                    <span className="text-xs leading-relaxed text-ink-300">
                      每成功 Show 一次，就把场上被盖过的那组牌收到自己面前。每张 = 1 分。
                    </span>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="inline-flex items-center shrink-0 rounded-full border border-white/20 px-2 py-0.5 font-mono text-[11px] text-ink-200">
                      + 被抽
                    </span>
                    <span className="text-xs leading-relaxed text-ink-300">
                      别人从你的牌组里 Scout 走 1 张牌时，你（原主人）得 1 分。
                    </span>
                  </div>
                </div>

                {/* 2-③ 一轮何时结束 & 结算 */}
                <p className="mb-1.5 mt-4 text-xs font-semibold text-ink-200">③ 一轮何时结束 &amp; 结算</p>
                <p className="text-xs leading-relaxed text-ink-300">满足以下任一条件，本轮立即结束：</p>
                <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-ink-300">
                  <li>
                    <span className="mr-1 font-bold text-ink-100">①</span>
                    有人出完所有手牌；
                  </li>
                  <li>
                    <span className="mr-1 font-bold text-ink-100">②</span>
                    某人 Show 之后，其余 3 人都只选择 Scout，轮回到 Show 者。
                    （此时 Show 者<b className="text-ink-100">免扣</b>剩余手牌分）
                  </li>
                </ul>
                <p className="text-xs leading-relaxed text-ink-300 mt-1.5">
                  结束后，手里每剩 1 张牌扣 1 分（− 剩牌）。
                </p>
                <p className="mt-2 rounded-lg bg-white/5 px-3 py-2 text-center text-xs font-bold text-ink-100">
                  本轮得分 = 收牌数 + 被抽分 − 剩余手牌数
                </p>
              </div>

              {/* 3. 整副翻转 */}
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-400">
                  🔁 整副翻转
                </p>
                <p className="text-xs leading-relaxed text-ink-300">
                  每轮开始、尚未行动前，可将整副手牌翻面（正反互换）。每轮限用一次。
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
