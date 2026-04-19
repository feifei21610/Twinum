/**
 * HandArea —— 玩家手牌区
 *
 * 功能：
 *   - 横向排列手牌（若超屏幕宽度则横滚）
 *   - 点击选中：上浮 + 紫光边
 *   - 显示 index 小角标（方便玩家确认相邻关系）
 *   - **Scout 插入模式**：在每两张牌之间 + 两端出现 N+1 个高亮插槽，点击完成 Scout
 *
 * 说明：手牌顺序严格按 game-engine 返回的 hand 数组，绝不重排
 */
import { motion } from 'framer-motion';
import type { Card as CardType } from '../types/game';
import { faceValue } from '../types/game';
import { Card } from './Card';
import { cn } from '../utils/cn';

export interface InsertSlotMode {
  /** 即将插入的卡牌（预览用） */
  previewCard: CardType;
  /** 点击插槽回调（传递 insertAt：0=最左、hand.length=最右） */
  onPickSlot: (insertAt: number) => void;
}

export interface HandAreaProps {
  hand: CardType[];
  selectedIndexes: number[];
  /** 是否可交互（非玩家回合时 disabled） */
  disabled?: boolean;
  onToggleCard: (index: number) => void;
  /** Scout 插入模式：传入时，手牌点击被禁用，改为显示插槽 */
  insertSlotMode?: InsertSlotMode;
  className?: string;
}

export function HandArea({
  hand,
  selectedIndexes,
  disabled = false,
  onToggleCard,
  insertSlotMode,
  className,
}: HandAreaProps): JSX.Element {
  const selectedSet = new Set(selectedIndexes);
  const isInsertMode = insertSlotMode != null;
  const cardsDisabled = disabled || isInsertMode;

  return (
    <div
      className={cn(
        'w-full overflow-x-auto scrollbar-hide',
        'px-3 pb-3 pt-6',
        className,
      )}
    >
      <div className="flex min-w-min items-end gap-1.5">
        {/* 最左端插槽（insertAt=0） */}
        {isInsertMode && (
          <InsertSlot
            insertAt={0}
            previewValue={faceValue(insertSlotMode.previewCard)}
            onClick={() => insertSlotMode.onPickSlot(0)}
          />
        )}

        {hand.map((card, index) => {
          const isSelected = selectedSet.has(index);
          return (
            <div key={card.id} className="flex items-end gap-1.5">
              <div
                className={cn(
                  'relative flex-shrink-0 transition-transform duration-200',
                  isSelected && '-translate-y-2',
                  isInsertMode && 'opacity-80',
                )}
              >
                {/* Index 小角标（仅在未选中 + 非插入模式时显示） */}
                {!isSelected && !isInsertMode && (
                  <span className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-medium text-ink-400/60">
                    {index}
                  </span>
                )}

                <Card
                  card={card}
                  size="sm"
                  selected={isSelected}
                  disabled={cardsDisabled}
                  onClick={() => !isInsertMode && onToggleCard(index)}
                />
              </div>

              {/* 每张牌后面的插槽（insertAt = index + 1） */}
              {isInsertMode && (
                <InsertSlot
                  insertAt={index + 1}
                  previewValue={faceValue(insertSlotMode.previewCard)}
                  onClick={() => insertSlotMode.onPickSlot(index + 1)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ========== 插槽组件 ==========

interface InsertSlotProps {
  insertAt: number;
  previewValue: number;
  onClick: () => void;
}

function InsertSlot({ insertAt, previewValue, onClick }: InsertSlotProps): JSX.Element {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1 }}
      whileHover={{ scaleX: 1.1 }}
      whileTap={{ scale: 0.9 }}
      transition={{ duration: 0.25, delay: insertAt * 0.03 }}
      className={cn(
        'group relative flex h-20 w-6 flex-shrink-0 items-center justify-center',
        'rounded-lg border-2 border-dashed border-neon-400/60',
        'bg-neon-400/10 backdrop-blur-sm',
        'hover:border-neon-400 hover:bg-neon-400/25',
        'active:scale-95',
        'cursor-pointer',
      )}
      aria-label={`插入位置 ${insertAt}`}
    >
      {/* 脉冲光晕 */}
      <motion.span
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 1.4, repeat: Infinity }}
        className="pointer-events-none absolute inset-0 rounded-lg bg-neon-400/20"
      />

      {/* 插入预览（数字 + 箭头） */}
      <div className="relative z-10 flex flex-col items-center gap-0.5">
        <span className="text-sm font-bold text-neon-400 drop-shadow-[0_0_4px_rgba(236,72,153,0.8)]">
          {previewValue}
        </span>
        <span className="text-[8px] font-semibold leading-none text-neon-400/80">
          ↓
        </span>
      </div>
    </motion.button>
  );
}
