import { getAvatarOption } from "@/lib/avatar-catalog";
import type { AvatarId } from "@/lib/explorer-identity";

const sizes = {
  sm: "size-16",
  md: "size-24",
  lg: "size-32 md:size-36",
} as const;

const iconSizes = {
  sm: "size-8",
  md: "size-12",
  lg: "size-16 md:size-[4.5rem]",
} as const;

type ExplorerAvatarProps = {
  avatarId: AvatarId;
  size?: keyof typeof sizes;
  floating?: boolean;
  className?: string;
};

export function ExplorerAvatar({
  avatarId,
  size = "lg",
  floating = false,
  className = "",
}: ExplorerAvatarProps) {
  const option = getAvatarOption(avatarId);
  const Icon = option.icon;

  return (
    <div
      className={`flex items-center justify-center rounded-[2rem] shadow-md ring-1 ring-black/5 ${sizes[size]} ${option.bubbleClass} ${floating ? "float-soft" : ""} ${className}`}
      aria-hidden
    >
      <Icon
        className={`${iconSizes[size]} ${option.iconClass}`}
        strokeWidth={2.25}
      />
    </div>
  );
}
