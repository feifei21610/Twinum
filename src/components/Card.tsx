/**
 * Card 组件 —— 单张双面卡牌
 *
 * 视觉规格（对齐 scout/docs/05-visual-style.md）：
 *   - 玻璃磨砂底 + 霓虹边缘
 *   - 当前朝上数字是大字主视觉；另一面的数字作为次要角标（右上角正向小字）
 *   - 未翻转（top 朝上）= 青色系 / 已翻转（bottom 朝上）= 琥珀色系
 *
 * 尺寸：默认 w-14 h-20（小），调用方可用 size prop 覆盖
 */
import { motion } from 'framer-motion';
import type { Card as CardType } from '../types/game';
import { faceValue } from '../types/game';
import { cn } from '../utils/cn';

export interface CardProps {
  card: CardType;
  /** 是否被选中（手牌选中态） */
  selected?: boolean;
  /** 是否可点击（不可点时 cursor: not-allowed） */
  disabled?: boolean;
  /** 点击回调 */
  onClick?: () => void;
  /** 尺寸：sm（手牌）/ md（场上）/ lg（开始页主视觉） */
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg';
  /** 是否背面朝上（对手手牌用） */
  faceDown?: boolean;
  /** 额外 className */
  className?: string;
}

const sizeClasses: Record<NonNullable<CardProps['size']>, string> = {
  xxs: 'w-7 h-10 text-sm',
  xs: 'w-10 h-14 text-lg',
  sm: 'w-14 h-20 text-2xl',
  md: 'w-16 h-24 text-3xl',
  lg: 'w-24 h-36 text-5xl',
};

const subNumberSize: Record<NonNullable<CardProps['size']>, string> = {
  xxs: 'text-[8px]',
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-lg',
};

export function Card({
  card,
  selected = false,
  disabled = false,
  onClick,
  size = 'sm',
  faceDown = false,
  className,
}: CardProps): JSX.Element {
  const face = faceValue(card);
  // 另一面数字（供玩家规划用的参考信息）
  const other = card.flipped ? card.top : card.bottom;
  const flipped = card.flipped;

  if (faceDown) {
    return (
      <div
        className={cn(
          'relative rounded-xl border border-white/10 bg-gradient-to-br from-surface-700 to-surface-800 shadow-md',
          'before:absolute before:inset-1.5 before:rounded-lg before:border before:border-white/5',
          sizeClasses[size],
          className,
        )}
        aria-label="对手手牌（背面）"
      >
        {/* 背面纹样 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-1/2 w-1/2 rounded-full bg-gradient-to-br from-primary-500/30 to-neon-500/30 blur-md" />
        </div>
      </div>
    );
  }

  const isFlippedStyle = flipped;

  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.96 }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        'relative rounded-xl border backdrop-blur-sm transition-all duration-200',
        'flex flex-col items-center justify-center font-bold',
        'shadow-md',
        sizeClasses[size],
        // 基础底色：未翻=青色系 / 已翻=琥珀色系
        isFlippedStyle
          ? 'bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-amber-400/40 text-amber-200'
          : 'bg-gradient-to-br from-cyan-500/20 to-primary-500/10 border-cyan-400/40 text-cyan-100',
        // 选中态：紫光边 + 上浮（由父级 HandArea 控制 translate-y）
        selected && 'ring-2 ring-offset-2 ring-offset-surface-900 ring-accent-500 shadow-neon-accent',
        // 禁用态
        disabled
          ? 'cursor-not-allowed opacity-60'
          : 'cursor-pointer hover:shadow-lg hover:brightness-110',
        className,
      )}
      aria-label={`卡牌 ${face}${flipped ? '（已翻面）' : ''}`}
    >
      {/* 主数字（居中大字） */}
      <span className="drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">{face}</span>

      {/* 另一面数字（右上角小字） */}
      <span
        className={cn(
          'absolute right-1 top-1 font-semibold opacity-60',
          subNumberSize[size],
        )}
      >
        {other}
      </span>

      {/* 底部小装饰线 */}
      <span
        className={cn(
          'absolute bottom-1 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full',
          isFlippedStyle ? 'bg-amber-400/60' : 'bg-cyan-400/60',
        )}
      />
    </motion.button>
  );
}
