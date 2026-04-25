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

const rule1Groups: { cards: CardType[]; caption: string }[] = [
  {
    cards: [
      { id: 'r1-1', top: 1, bottom: 8, flipped: false },
      { id: 'r1-2', top: 2, bottom: 7, flipped: false },
      { id: 'r1-3', top: 3, bottom: 6, flipped: false },
    ],
    caption: '3 张连续 · 张数最多',
  },
  {
    cards: [
      { id: 'r2-1', top: 4, bottom: 5, flipped: false },
      { id: 'r2-2', top: 4, bottom: 3, flipped: false },
    ],
    caption: '2 张同数字 · 强于连续',
  },
  {
    cards: [
      { id: 'r3-1', top: 5, bottom: 4, flipped: false },
      { id: 'r3-2', top: 6, bottom: 3, flipped: false },
    ],
    caption: '2 张连续',
  },
  {
    cards: [{ id: 'r4-1', top: 7, bottom: 2, flipped: false }],
    caption: '单张 · 最弱',
  },
];

// 卡片解剖示意用
const demoCard: CardType = { id: 'demo-card', top: 3, bottom: 7, flipped: false };

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

              {/* 0. 游戏概览（一行信息胶囊） */}
              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-400">
                  🎮 游戏概览
                </p>
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs leading-relaxed text-ink-200">
                  <b className="text-ink-50">4 人</b> 游戏 ·
                  每人 <b className="text-ink-50">11 张</b> 手牌 ·
                  共 <b className="text-ink-50">4 轮</b> ·
                  <b className="text-ink-50">累计总分最高者获胜</b>
                </div>
              </div>

              {/* 1. 卡片速览 */}
              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-400">
                  🃏 卡片速览
                </p>
                <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-3">
                  <div className="shrink-0">
                    <Card card={demoCard} size="md" disabled />
                  </div>
                  <ul className="flex-1 space-y-1 text-[11px] leading-relaxed text-ink-300">
                    <li>
                      <b className="text-ink-100">中央大数字</b> ＝ 当前朝上的面，
                      <b className="text-cyan-300">只有这个数字参与出牌和比较</b>。
                    </li>
                    <li>
                      <b className="text-ink-100">右上角小数字</b> ＝ 背面数字，始终可见，供你规划用。
                    </li>
                    <li>
                      <b className="text-ink-100">翻面后</b>两数互换（颜色从青变琥珀），朝上的数字随之改变。
                    </li>
                  </ul>
                </div>
              </div>

              {/* 2. 玩法流程 */}
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-400">
                  🔀 玩法流程
                </p>

                {/* 2-① 操作说明 */}
                <p className="mb-1.5 text-xs font-semibold text-ink-200">① 操作说明（每回合三选一）</p>

                {/* 关键前置：手牌顺序固定 */}
                <p className="mb-2 rounded-md border border-amber-400/30 bg-amber-400/5 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-200/90">
                  ⚠ <b>手牌顺序固定</b>，不能自由排序——这是核心机制。
                </p>

                <div className="space-y-3">

                  {/* Show */}
                  <div>
                    <div className="flex gap-2.5">
                      <span className="inline-flex items-center shrink-0 rounded-full border border-white/20 px-2.5 py-0.5 font-mono text-[11px] text-ink-200">
                        Show（出牌）
                      </span>
                      <span className="text-xs leading-relaxed text-ink-300">
                        从手牌中选<b className="text-ink-100">位置相邻</b>的 1 张或多张牌（不能跳过中间的牌），
                        多张牌须为「<b className="text-ink-100">同数字</b>」（如 3-3-3）或「<b className="text-ink-100">连续数字</b>」
                        <span className="text-[11px] text-ink-400">（如 3-4-5 或 5-4-3，不可乱序）</span>，
                        并能<b className="text-ink-100">盖过场上牌组</b>。场上无牌时可任意出。
                        <br />
                        <span className="text-[11px] text-ink-400">
                          打出的牌叠到<b className="text-ink-300">场上牌组</b>，仍<b className="text-cyan-300">标记为你的</b>——对手 Scout 走时你得分（见计分）。
                        </span>
                      </span>
                    </div>
                    {/* 牌组强度子项 */}
                    <div className="ml-2 mt-2 rounded-lg bg-white/5 px-3 py-2">
                      <p className="mb-1 text-[11px] font-semibold text-ink-300">
                        牌型强度比较顺序：
                      </p>
                      <ul className="space-y-0.5 text-xs leading-relaxed text-ink-400">
                        <li><span className="mr-1 font-bold text-ink-200">①</span> 张数多的更强（3 张 &gt; 2 张 &gt; 1 张）；</li>
                        <li><span className="mr-1 font-bold text-ink-200">②</span> 相同张数时，<b className="text-ink-300">同数字型</b> 强于 <b className="text-ink-300">连续数字型</b>；</li>
                        <li><span className="mr-1 font-bold text-ink-200">③</span> 张数、类型相同时，<b className="text-ink-300">按朝上数字大小</b>比较。</li>
                        <li className="mt-1 text-[11px] text-ink-500">※ 强度比较只看<b className="text-ink-400">当前朝上的数字</b>，与背面无关。</li>
                      </ul>
                      <div className="mt-2 flex items-end justify-center gap-1">
                        {rule1Groups.map((grp, i) => (
                          <div key={i} className="flex items-end gap-1">
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="flex items-end gap-0.5">
                                {grp.cards.map((c) => (
                                  <Card key={c.id} card={c} size="xxs" disabled />
                                ))}
                              </div>
                              <span className="text-[10px] leading-tight text-ink-500 text-center">
                                {grp.caption}
                              </span>
                            </div>
                            {i < rule1Groups.length - 1 && (
                              <span className="shrink-0 pb-4 text-sm font-bold text-ink-300">›</span>
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
                      从<b className="text-ink-100">场上牌组</b>（即上一位 Show 出的那组牌）的<b className="text-ink-100">最左或最右</b>抽 1 张，
                      可选择是否<b className="text-ink-100">翻面</b>后再插入自己手牌任意位置。
                      <span className="text-[11px] text-ink-400">
                        （被抽走的牌所属的<b className="text-ink-300">原主人得 1 分</b>。）
                      </span>
                    </span>
                  </div>

                  {/* S&S */}
                  <div className="flex gap-2.5">
                    <span className="inline-flex items-center shrink-0 rounded-full border border-white/20 px-2.5 py-0.5 font-mono text-[11px] text-ink-200">
                      S&amp;S
                    </span>
                    <span className="text-xs leading-relaxed text-ink-300">
                      <b className="text-ink-100">Scout &amp; Show（先抽后出）</b>：先 Scout 一张插入手牌，紧接着立即 Show 一次。
                      只需盖过 Scout 之后的场上牌组即可。<b className="text-ink-100">每轮限 1 次</b>。
                    </span>
                  </div>

                </div>

                {/* 2-② 计分规则 */}
                <p className="mb-1.5 mt-4 text-xs font-semibold text-ink-200">② 计分规则</p>
                <div className="space-y-2.5">
                  <div className="flex gap-2.5">
                    <span className="inline-flex items-center shrink-0 rounded-full border border-white/20 px-2 py-0.5 font-mono text-[11px] text-ink-200">
                      + 吃牌
                    </span>
                    <span className="text-xs leading-relaxed text-ink-300">
                      Show 之后，场上被盖过的那组牌收到你的得分堆。每张 = 1 分。
                    </span>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="inline-flex items-center shrink-0 rounded-full border border-white/20 px-2 py-0.5 font-mono text-[11px] text-ink-200">
                      + 被抽
                    </span>
                    <span className="text-xs leading-relaxed text-ink-300">
                      你 Show 出的牌每被 Scout 走 1 张，你 +1 分。
                    </span>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="inline-flex items-center shrink-0 rounded-full border border-white/20 px-2 py-0.5 font-mono text-[11px] text-ink-200">
                      − 剩牌
                    </span>
                    <span className="text-xs leading-relaxed text-ink-300">
                      本轮结束时，手里每剩 1 张牌扣 1 分。
                    </span>
                  </div>
                </div>
                <p className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-center text-xs font-bold text-ink-100">
                  本轮得分 = 吃牌数 + 被抽数 − 剩牌数
                </p>

                {/* 2-③ 一轮何时结束 */}
                <p className="mb-1.5 mt-4 text-xs font-semibold text-ink-200">③ 一轮何时结束</p>
                <p className="text-xs leading-relaxed text-ink-300">
                  满足任一条件即结束：<b className="text-ink-100">①</b> 有人出完所有手牌；
                  <b className="text-ink-100">②</b> 你 Show 后，其他三人都只 Scout，一圈回到你时，本轮结束。
                  <span className="text-[11px] text-ink-400">
                    （条件 ② 下，<b className="text-ink-300">Show 者免扣剩牌分</b>，其余 3 人仍按剩牌数扣分。）
                  </span>
                </p>
              </div>

              {/* 3. 整副翻转 */}
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-400">
                  🔁 整副翻转
                </p>
                <p className="text-xs leading-relaxed text-ink-300">
                  每轮开始、尚未行动前，可将<b className="text-ink-100">整副手牌翻面</b>（正反互换）。<b className="text-ink-100">每轮限 1 次</b>。
                  <span className="text-[11px] text-ink-400">
                    （开局大数多时可翻一次博小连。）
                  </span>
                </p>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 完整回合示例（默认折叠） ──────────────────────────────────

function RoundExampleCard(): JSX.Element {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass mt-4 overflow-hidden rounded-2xl border border-white/10">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="round-example-panel"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <span className="flex-1 text-sm font-bold text-ink-50">🎬 看个例子</span>
        <span className="text-[11px] text-ink-400">完整回合走一遍</span>
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
            id="round-example-panel"
            key="round-example-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-2 border-t border-white/5 px-4 pb-5 pt-4 text-xs leading-relaxed text-ink-300">
              <p className="text-[11px] text-ink-400">假设 4 人依次为 A/B/C/D，都是 11 张手牌：</p>
              <ol className="space-y-1.5">
                <li>
                  <b className="text-ink-100">1. A 开局 Show：</b>桌面无牌，A 从手中打出相邻的 <b className="text-cyan-300">3-4-5</b>（三张连续）。
                </li>
                <li>
                  <b className="text-ink-100">2. B 选择 Scout：</b>认为自己的组合压不过，从 A 这组的<b>最右端</b>抽走 <b className="text-cyan-300">5</b>，翻面后插入手牌。
                  <br />
                  <span className="text-[11px] text-ink-400">A 因被抽 1 张得 <b className="text-cyan-300">+1 分</b>；场上牌组剩 A 的 3-4。</span>
                </li>
                <li>
                  <b className="text-ink-100">3. C 用 S&amp;S：</b>先从场上牌组 Scout 走 <b className="text-cyan-300">4</b>，再立即 Show 出自己的 <b className="text-cyan-300">6-6</b>（2 张同数字）盖过。
                  <br />
                  <span className="text-[11px] text-ink-400">A 再因被抽 1 张得 <b className="text-cyan-300">+1 分</b>；C 吃掉场上牌组剩下的 3（<b className="text-cyan-300">+1 分</b>）。</span>
                </li>
                <li>
                  <b className="text-ink-100">4. D 选择 Show：</b>打出 <b className="text-cyan-300">7-7</b> 盖过 C 的 6-6（同 2 张同数字但更大）。
                  <br />
                  <span className="text-[11px] text-ink-400">D 吃掉 C 的 6-6（<b className="text-cyan-300">+2 分</b>）。</span>
                </li>
                <li>
                  <b className="text-ink-100">5. 轮回到 A：</b>A 压不过 7-7，只能 Scout 或 S&amp;S…… 如此循环，直到有人出空手牌、或某人 Show 后其余 3 人全 Scout 回到他身上，本轮结束。
                </li>
              </ol>
              <p className="mt-2 rounded-lg bg-white/5 px-3 py-1.5 text-[11px] leading-relaxed text-ink-400">
                📊 <b className="text-ink-300">本轮结算示例：</b>A +2（被抽）/ C +1（吃牌）/ D +2（吃牌）/ B 0（只抽未吃）；各人再减自己手里剩牌数。
              </p>
              <p className="text-[11px] text-ink-500">
                4 轮累计，高者胜。
              </p>
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
        <RoundExampleCard />
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
