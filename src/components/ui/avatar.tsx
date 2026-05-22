import { cn } from "@/lib/utils";

function Avatar({
  className,
  src,
  alt,
  initials,
  size = "md",
}: {
  className?: string;
  src?: string;
  alt?: string;
  initials?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "size-7 text-xs",
    md: "size-9 text-sm",
    lg: "size-12 text-base",
  };

  return (
    <div
      data-slot="avatar"
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-medium text-primary select-none",
        sizeClasses[size],
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt ?? ""} className="size-full object-cover" />
      ) : (
        <span>{initials ?? "?"}</span>
      )}
    </div>
  );
}

export { Avatar };
