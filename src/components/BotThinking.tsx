/**
 * BotThinking —— Bot 思考省略号气泡
 *
 * 3 个圆点依次浮起回落，模拟"正在输入/思考"
 */
import { motion } from 'framer-motion';
import { cn } from '../utils/cn';

export interface BotThinkingProps {
  className?: string;
}

const dotAnim = {
  initial: { y: 0, opacity: 0.3 },
  animate: { y: -4, opacity: 1 },
  transition: {
    duration: 0.6,
    repeat: Infinity,
    repeatType: 'reverse' as const,
  },
};

export function BotThinking({ className }: BotThinkingProps): JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-full bg-surface-800/90 px-2.5 py-1 shadow-md backdrop-blur-sm',
        'border border-accent-500/30',
        className,
      )}
      role="status"
      aria-label="Bot 思考中"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block h-1.5 w-1.5 rounded-full bg-neon-400"
          {...dotAnim}
          transition={{
            ...dotAnim.transition,
            delay: i * 0.15,
          }}
        />
      ))}
    </div>
  );
}
