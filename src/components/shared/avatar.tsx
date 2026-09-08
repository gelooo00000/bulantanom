import { cn } from "@/lib/utils";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type AvatarProps = {
  name: string;
  size?: "sm" | "default";
  className?: string;
};

export function Avatar({ name, size = "default", className }: AvatarProps) {
  return (
    <span
      className={cn(
        "bg-primary/10 text-primary flex shrink-0 items-center justify-center rounded-full font-medium",
        size === "sm" ? "size-7 text-xs" : "size-9 text-sm",
        className,
      )}
    >
      {getInitials(name)}
    </span>
  );
}
