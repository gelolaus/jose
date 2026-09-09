import {
  BookOpen,
  Compass,
  Leaf,
  Ship,
  Star,
  Sun,
  type LucideIcon,
} from "lucide-react";
import type { AvatarId } from "./explorer-identity";

export type AvatarOption = {
  id: AvatarId;
  label: string;
  bubbleClass: string;
  iconClass: string;
  icon: LucideIcon;
};

export const AVATAR_CATALOG: AvatarOption[] = [
  {
    id: "compass",
    label: "Compass",
    bubbleClass: "bg-sky-100",
    iconClass: "text-sky-600",
    icon: Compass,
  },
  {
    id: "sun",
    label: "Sun",
    bubbleClass: "bg-amber-100",
    iconClass: "text-amber-600",
    icon: Sun,
  },
  {
    id: "book",
    label: "Book",
    bubbleClass: "bg-[#e0d0f0]",
    iconClass: "text-[#1a2a5e]",
    icon: BookOpen,
  },
  {
    id: "star",
    label: "Star",
    bubbleClass: "bg-yellow-100",
    iconClass: "text-amber-500",
    icon: Star,
  },
  {
    id: "leaf",
    label: "Leaf",
    bubbleClass: "bg-[#e8dcc0]",
    iconClass: "text-[#1a2a5e]",
    icon: Leaf,
  },
  {
    id: "ship",
    label: "Ship",
    bubbleClass: "bg-[#f0d8de]",
    iconClass: "text-rose-600",
    icon: Ship,
  },
];

export function getAvatarOption(avatarId: AvatarId): AvatarOption {
  return (
    AVATAR_CATALOG.find((option) => option.id === avatarId) ?? AVATAR_CATALOG[0]!
  );
}
