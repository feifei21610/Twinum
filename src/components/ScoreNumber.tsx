/**
 * ScoreNumber —— 数字滚动动画组件
 *
 * 用于结算页分数揭晓时"从 0 滚动到最终分"的效果
 */
import { useEffect, useState } from 'react';
import { cn } from '../utils/cn';

export interface ScoreNumberProps {
  value: number;
  /** 动画时长（毫秒） */
  durationMs?: number;
  /** 是否显示 +/- 前缀 */
  showSign?: boolean;
  className?: string;
}

export function ScoreNumber({
  value,
  durationMs = 1200,
  showSign = false,
  className,
}: ScoreNumberProps): JSX.Element {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const startValue = 0;
    const endValue = value;

    let frame = 0;
    const step = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (endValue - startValue) * eased);
      setDisplayed(current);
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);

  const prefix = showSign && displayed > 0 ? '+' : '';

  return (
    <span className={cn('tabular-nums', className)}>
      {prefix}
      {displayed}
    </span>
  );
}
