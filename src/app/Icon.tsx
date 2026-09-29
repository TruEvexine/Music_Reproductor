export type IconName =
  | "add"
  | "clear"
  | "check"
  | "library"
  | "next"
  | "pause"
  | "play"
  | "previous"
  | "queue"
  | "user";

const paths: Record<IconName, string> = {
  add: "M12 5v14M5 12h14",
  clear: "M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3",
  check: "m5 12 4 4L19 6",
  library: "M4 19V5m5 14V5m5 14V5m5 14V5",
  next: "M5 5l10 7-10 7V5zm14 0v14",
  pause: "M8 5v14m8-14v14",
  play: "m7 4 13 8-13 8V4z",
  previous: "m19 5-10 7 10 7V5zM5 5v14",
  queue: "M4 6h16M4 12h11M4 18h8m5-3 4 3-4 3v-6z",
  user: "M20 21a8 8 0 0 0-16 0m8-10a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
};

export function Icon({
  name,
  size = 20,
}: {
  name: IconName;
  size?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
