/**
 * ActionBar —— 底部动作栏
 *
 * 4 个按钮：Show / Scout / Scout & Show / Flip Hand
 *
 * Show 判定：
 *   - 必须已选中至少 1 张
 *   - 选中的 index 必须相邻（连续）
 *   - 组成的组必须合法（same / run）
 *   - 必须能盖过场上 Active Set（若有）
 *
 * Scout / Scout&Show 流程（两步）：
 *   Step 1: 弹面板选 from（left/right）+ flip（true/false）
 *   Step 2: 手牌区出现 N+1 个高亮插槽，玩家点击某个完成插入
 *     - insertAt=0 表示最左；insertAt=hand.length 表示最右
 *
 * Scout&Show 的 Show index 偏移：
 *   用户在 Step 0（未点 S&S 前）选中的手牌 index 是基于"原手牌"
 *   插入 Scout 牌后，若 insertAt ≤ 原 index → 原 index + 1
 *   派发时自动偏移
 */
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Zap, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import type {
  Action,
  Card as CardType,
  CardGroup,
  GameState,
} from '../types/game';
import { faceValue } from '../types/game';
import { legalActionsFor } from '../game-engine/rules';
import { cn } from '../utils/cn';

export interface ScoutPendingParams {
  mode: 'scout' | 'sas';
  from: 'left' | 'right';
  flip: boolean;
  /** 经 flip 后玩家实际抽到的那张卡（预览用）*/
  preview: CardType;
}

export interface ActionBarProps {
  game: GameState;
  playerIndex: number;
  selectedIndexes: number[];
  onAction: (action: Action) => void;
  onClearSelection: () => void;
  /** Scout Step 2 的 pending 状态由父级（GamePage）持有，以便 HandArea 同步渲染插槽 */
  scoutPending: ScoutPendingParams | null;
  setScoutPending: (p: ScoutPendingParams | null) => void;
  className?: string;
}

function findMatchingLegalShow(
  shows: Array<{ cardIndexes: number[]; group: CardGroup }>,
  selected: number[],
): { cardIndexes: number[]; group: CardGroup } | null {
  if (selected.length === 0) return null;
  const selSorted = [...selected].sort((a, b) => a - b);
  return (
    shows.find(
      (s) =>
        s.cardIndexes.length === selSorted.length &&
        s.cardIndexes.every((v, i) => v === selSorted[i]),
    ) ?? null
  );
}

/** 把 Scout 抽到的那张牌应用 flip（供预览）*/
function buildScoutPreview(
  activeSet: CardGroup,
  from: 'left' | 'right',
  flip: boolean,
): CardType {
  const pickedIdx = from === 'left' ? 0 : activeSet.cards.length - 1;
  const picked = activeSet.cards[pickedIdx];
  return flip ? { ...picked, flipped: !picked.flipped } : picked;
}

export function ActionBar({
  game,
  playerIndex,
  selectedIndexes,
  onAction,
  onClearSelection,
  scoutPending,
  setScoutPending,
  className,
}: ActionBarProps): JSX.Element {
  const player = game.players[playerIndex];
  const legal = legalActionsFor(game, playerIndex);

  // Step 1 面板（选 from+flip）开关
  const [sourcePanel, setSourcePanel] = useState<null | 'scout' | 'sas'>(null);

  // Show 可用性
  const matchedShow = useMemo(
    () => findMatchingLegalShow(legal.shows, selectedIndexes),
    [legal.shows, selectedIndexes],
  );
  const canShow = matchedShow != null;

  // Scout 可用性
  const canScout = legal.canScout;

  // Scout & Show 可用性
  const canScoutAndShow =
    legal.canScoutAndShow && selectedIndexes.length >= 1;

  // Flip Hand 可用性
  const canFlipHand = legal.canFlipHand;

  // 当前是否处于 Step 2（选插入位置）
  const inSlotPhase = scoutPending != null;

  const handleShow = () => {
    if (!canShow || !matchedShow) return;
    onAction({ type: 'SHOW', cardIndexes: matchedShow.cardIndexes });
  };

  const handleFlipHand = () => {
    if (!canFlipHand) return;
    onAction({ type: 'FLIP_HAND' });
  };

  // Step 1 → Step 2：选完 from+flip 后进入插槽选择
  const handleSourcePick = (
    mode: 'scout' | 'sas',
    from: 'left' | 'right',
    flip: boolean,
  ) => {
    if (!game.activeSet) return;
    const preview = buildScoutPreview(game.activeSet, from, flip);
    setSourcePanel(null);
    setScoutPending({ mode, from, flip, preview });
  };

  // Step 2：外部（HandArea）点击插槽后调用
  // 这个函数实际由 GamePage 绑定给 HandArea；这里暴露给 GamePage 调用
  // （通过 scoutPending + onConfirmInsert 两个合同字段实现）—— 见 GamePage

  // 取消 Scout 流程
  const handleCancelScout = () => {
    setScoutPending(null);
    setSourcePanel(null);
  };

  return (
    <div
      className={cn(
        'relative w-full border-t border-white/5 bg-surface-900/80 px-3 py-3 backdrop-blur-md',
        className,
      )}
    >
      {/* Step 2 提示条 */}
      {inSlotPhase && scoutPending && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-neon-500/10 px-3 py-2 text-xs">
          <span className="text-neon-400">
            {scoutPending.mode === 'sas' ? 'Scout & Show' : 'Scout'} · 要抽：
            <span className="ml-1 font-bold">
              {faceValue(scoutPending.preview)}
            </span>
            {scoutPending.flip && (
              <span className="ml-1 text-ink-400">（翻面）</span>
            )}
            <span className="ml-2 text-ink-400">→ 点击手牌间的高亮插槽</span>
          </span>
          <button
            type="button"
            onClick={handleCancelScout}
            className="text-[11px] font-semibold text-ink-400 hover:text-ink-50"
          >
            取消
          </button>
        </div>
      )}

      {/* 选中提示条 */}
      {!inSlotPhase && selectedIndexes.length > 0 && (
        <div className="mb-2 flex items-center justify-between text-[11px]">
          <span className="text-ink-400">
            已选 {selectedIndexes.length} 张
            {matchedShow &&
              ` · ${matchedShow.group.kind === 'same' ? '同数组' : '连续组'} min=${matchedShow.group.minValue}`}
          </span>
          <button
            type="button"
            onClick={onClearSelection}
            className="text-xs text-neon-400 hover:text-neon-500"
          >
            清空选择
          </button>
        </div>
      )}

      {/* 主按钮区（Step 2 时全部置灰，避免误点） */}
      <div className="flex items-stretch gap-2">
        <ActionButton
          label="Show"
          icon={<Check className="h-4 w-4" />}
          enabled={canShow && !inSlotPhase}
          onClick={handleShow}
          variant="primary"
          tooltip={
            canShow
              ? '出牌'
              : selectedIndexes.length === 0
                ? '先选择手牌'
                : '当前选择无法组成合法牌组或无法盖过场上'
          }
        />

        <ActionButton
          label="Scout"
          icon={<ChevronLeft className="h-4 w-4" />}
          enabled={canScout && !inSlotPhase}
          active={sourcePanel === 'scout'}
          onClick={() =>
            canScout && setSourcePanel((v) => (v === 'scout' ? null : 'scout'))
          }
          variant="secondary"
          tooltip={canScout ? '从场上抽一张' : '场上无牌可抽'}
        />

        <ActionButton
          label="S&S"
          icon={<Zap className="h-4 w-4" />}
          enabled={canScoutAndShow && !inSlotPhase}
          active={sourcePanel === 'sas'}
          onClick={() =>
            canScoutAndShow && setSourcePanel((v) => (v === 'sas' ? null : 'sas'))
          }
          variant="neon"
          tooltip={
            legal.canScoutAndShow
              ? canScoutAndShow
                ? 'Scout 后立即出牌'
                : '先选择要出的手牌'
              : player.scoutShowChipUsed
                ? 'Chip 已用过'
                : '场上需要有牌'
          }
        />

        <ActionButton
          label="翻面"
          icon={<RefreshCw className="h-4 w-4" />}
          enabled={canFlipHand && !inSlotPhase}
          onClick={handleFlipHand}
          variant="ghost"
          tooltip={canFlipHand ? '整副翻转（仅本轮开局可用）' : '本轮已出过动作'}
        />
      </div>

      {/* Step 1 子面板 */}
      <AnimatePresence>
        {sourcePanel && !inSlotPhase && game.activeSet && (
          <SourcePanel
            game={game}
            title={
              sourcePanel === 'sas'
                ? 'Scout & Show · 第 1 步：选抽哪端'
                : 'Scout · 第 1 步：选抽哪端'
            }
            onPick={(from, flip) => handleSourcePick(sourcePanel, from, flip)}
            onClose={() => setSourcePanel(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ========== 内部子组件 ==========

interface ActionButtonProps {
  label: string;
  icon: JSX.Element;
  enabled: boolean;
  active?: boolean;
  onClick: () => void;
  variant: 'primary' | 'secondary' | 'neon' | 'ghost';
  tooltip: string;
}

const variantClasses: Record<ActionButtonProps['variant'], string> = {
  primary: 'bg-gradient-neon text-white shadow-neon-primary',
  secondary: 'bg-surface-700 text-ink-50 border border-white/10',
  neon: 'bg-neon-500/90 text-white shadow-neon-pink',
  ghost: 'bg-surface-800 text-ink-300 border border-white/5',
};

function ActionButton({
  label,
  icon,
  enabled,
  active,
  onClick,
  variant,
  tooltip,
}: ActionButtonProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={enabled ? onClick : undefined}
      disabled={!enabled}
      title={tooltip}
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-xs font-semibold transition-all',
        enabled
          ? variantClasses[variant]
          : 'cursor-not-allowed bg-surface-800/50 text-ink-400',
        enabled && 'active:scale-95',
        active &&
          'ring-2 ring-offset-2 ring-offset-surface-900 ring-accent-500',
      )}
    >
      <span className="flex items-center gap-1">
        {icon}
        <span>{label}</span>
      </span>
    </button>
  );
}

interface SourcePanelProps {
  game: GameState;
  title: string;
  onPick: (from: 'left' | 'right', flip: boolean) => void;
  onClose: () => void;
}

function SourcePanel({ game, title, onPick, onClose }: SourcePanelProps): JSX.Element {
  const active = game.activeSet;
  if (!active) {
    onClose();
    return <></>;
  }

  const leftCard: CardType = active.cards[0];
  const rightCard: CardType | null =
    active.cards.length > 1 ? active.cards[active.cards.length - 1] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute inset-x-3 bottom-full mb-2 rounded-xl border border-white/10 bg-surface-800/95 p-3 shadow-lg backdrop-blur-lg"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-50">{title}</span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-ink-400 hover:text-ink-50"
        >
          取消
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex flex-col gap-1.5 rounded-lg bg-surface-900/50 p-2">
          <div className="flex items-center gap-1 text-ink-300">
            <ChevronLeft className="h-3 w-3" />
            <span>左端：{leftCard.flipped ? leftCard.bottom : leftCard.top}</span>
          </div>
          <button
            type="button"
            onClick={() => onPick('left', false)}
            className="rounded-md bg-primary-500/80 py-1 text-white hover:bg-primary-500 active:scale-95"
          >
            抽（不翻）
          </button>
          <button
            type="button"
            onClick={() => onPick('left', true)}
            className="rounded-md bg-accent-500/80 py-1 text-white hover:bg-accent-500 active:scale-95"
          >
            抽（翻面 → {leftCard.flipped ? leftCard.top : leftCard.bottom}）
          </button>
        </div>

        <div className="flex flex-col gap-1.5 rounded-lg bg-surface-900/50 p-2">
          <div className="flex items-center gap-1 text-ink-300">
            <ChevronRight className="h-3 w-3" />
            <span>
              右端：
              {rightCard
                ? rightCard.flipped
                  ? rightCard.bottom
                  : rightCard.top
                : '—'}
            </span>
          </div>
          <button
            type="button"
            disabled={!rightCard}
            onClick={() => onPick('right', false)}
            className={cn(
              'rounded-md py-1 text-white active:scale-95',
              rightCard
                ? 'bg-primary-500/80 hover:bg-primary-500'
                : 'cursor-not-allowed bg-surface-700 opacity-40',
            )}
          >
            抽（不翻）
          </button>
          <button
            type="button"
            disabled={!rightCard}
            onClick={() => onPick('right', true)}
            className={cn(
              'rounded-md py-1 text-white active:scale-95',
              rightCard
                ? 'bg-accent-500/80 hover:bg-accent-500'
                : 'cursor-not-allowed bg-surface-700 opacity-40',
            )}
          >
            抽（翻面 →{' '}
            {rightCard
              ? rightCard.flipped
                ? rightCard.top
                : rightCard.bottom
              : '—'}
            ）
          </button>
        </div>
      </div>
      <div className="mt-2 text-[10px] text-ink-400">
        下一步：在手牌之间选择要插入的位置
      </div>
    </motion.div>
  );
}
