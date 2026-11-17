import { Star } from 'lucide-react';

export function StarRating({
  value,
  onChange,
  size = 20,
  readOnly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          className={readOnly ? 'cursor-default' : 'hover:scale-110 transition'}
        >
          <Star
            style={{ width: size, height: size }}
            className={n <= value ? 'fill-accent-400 text-accent-400' : 'text-ink-300'}
          />
        </button>
      ))}
    </div>
  );
}
