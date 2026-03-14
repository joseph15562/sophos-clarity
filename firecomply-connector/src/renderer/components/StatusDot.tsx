interface Props {
  status: "idle" | "running" | "success" | "error" | string;
}

export function StatusDot({ status }: Props) {
  const color =
    status === "success" || status === "online"
      ? "bg-green-500"
      : status === "running"
        ? "bg-blue-500 animate-pulse"
        : status === "error"
          ? "bg-red-500"
          : "bg-gray-400";

  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color} shrink-0`} />;
}
