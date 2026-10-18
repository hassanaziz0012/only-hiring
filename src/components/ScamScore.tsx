const SEGMENTS = 10;

export function scoreText(score: number) {
  return score.toFixed(2).replace(/0$/, "");
}

/** Ten squares, filled up to the score. Scores between tenths partly fill a square. */
function ScoreBar({ score, className }: { score: number; className: string }) {
  return (
    <span className={`flex gap-1 ${className}`}>
      {Array.from({ length: SEGMENTS }, (_, i) => {
        const fill = Math.min(1, Math.max(0, score * SEGMENTS - i));
        return (
          <span key={i} className="relative h-full flex-1 bg-pink-deep/25">
            {fill > 0 && <span className="absolute inset-y-0 left-0 bg-pink-deep" style={{ width: `${fill * 100}%` }} />}
          </span>
        );
      })}
    </span>
  );
}

/**
 * The scam score at a glance, floated into the warning box's top-right corner.
 * The sentence beside it already reads the score out, so this is hidden from
 * screen readers.
 */
export function ScamScore({ score }: { score: number }) {
  return (
    <div aria-hidden="true" className="float-right mb-3 ml-5 w-28 md:w-32">
      <p className="text-right tabular-nums">
        <span className="text-head font-bold text-pink-deep">{scoreText(score)}</span>
        <span className="font-bold"> / 1</span>
      </p>
      <ScoreBar score={score} className="mt-2 h-3 w-full" />
      <p className="mt-1.5 flex justify-between text-small">
        <span>0</span>
        <span>Scam score</span>
        <span>1</span>
      </p>
    </div>
  );
}
