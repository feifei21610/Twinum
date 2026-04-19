/**
 * RulesPage —— 规则说明页（MVP 占位版）
 *
 * 完整六段图文规则放到 Todo 6 pages-assembly 实现。
 * 当前用文字列表快速传达核心规则。
 */
import { ChevronLeft } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

const sections = [
  {
    title: '🎯 目标',
    content:
      '4 人局打 4 轮，每轮结束结算：已收集翻面牌数 + Scout Chip 数 − 剩余手牌数。总分最高者获胜。',
  },
  {
    title: '🃏 出牌（Show）',
    content:
      '出一组"同数字"或"连续数字"的相邻手牌。牌组越长越强；同长度下"相同组 > 连续组"；类型相同时最小数字大者胜。第一家随意出；后续必须能盖过场上牌组才能出。',
  },
  {
    title: '🔍 Scout 抽牌',
    content:
      '如果你不想/不能出牌，可以从场上牌组的左端或右端抽一张，可选翻面，插入到你手牌的任意位置。那张牌的原主人会得到 1 个 Scout Chip（每个 1 分）。',
  },
  {
    title: '⚡ Scout & Show',
    content:
      '特殊动作：先 Scout 一张再立即出牌。每人每局只能用 1 次。打出后 Chip 消失，无法复用。',
  },
  {
    title: '🔁 整副翻转',
    content:
      '在一轮开始、你尚未做任何动作前，可以把整副手牌翻面（所有牌的正反面互换）。每轮只能用一次。',
  },
  {
    title: '🏁 回合结束',
    content:
      '两种触发：① 有人出完所有手牌 ② 有人 Show 后，其他所有玩家都只 Scout 不 Show，轮回到 Show 者。第 ② 种的 Show 者免扣剩余手牌分。',
  },
];

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

      {/* 规则列表 */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5">
        {sections.map((s) => (
          <div key={s.title} className="glass rounded-xl p-4">
            <h2 className="mb-1.5 text-sm font-bold text-ink-50">{s.title}</h2>
            <p className="text-xs leading-relaxed text-ink-300">{s.content}</p>
          </div>
        ))}

        <p className="px-2 pt-2 text-center text-[10px] text-ink-400/60">
          完整规则图文版将在后续版本补充
        </p>
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
