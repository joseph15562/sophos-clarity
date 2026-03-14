interface Props {
  score: number;
  grade: string;
}

export function ScoreBadge({ score, grade }: Props) {
  const color =
    score >= 90 ? "text-green-500 bg-green-500/10"
    : score >= 75 ? "text-blue-500 bg-blue-500/10"
    : score >= 60 ? "text-yellow-500 bg-yellow-500/10"
    : score >= 40 ? "text-orange-500 bg-orange-500/10"
    : "text-red-500 bg-red-500/10";

  return (
    <span className={`text-sm font-bold px-2 py-1 rounded-lg ${color}`}>
      {score}<span className="text-[10px] font-normal ml-0.5">/{grade}</span>
    </span>
  );
}
