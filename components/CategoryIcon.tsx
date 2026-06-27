import { categoryMeta } from "@/components/civic/meta";

// Civic category tile: a lucide glyph in an accent-tinted rounded square (no emoji).
export default function CategoryIcon({
  category,
  className = "",
  size = 20,
}: {
  category: string;
  className?: string;
  size?: number;
}) {
  const { Icon, label } = categoryMeta(category);
  return (
    <span className={`cv-icon-tile ${className}`} role="img" aria-label={label}>
      <Icon size={size} strokeWidth={2} />
    </span>
  );
}
