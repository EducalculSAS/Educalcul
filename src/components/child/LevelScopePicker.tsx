"use client";

import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import { getCatalogLevelLabel } from "@/lib/constants";

interface LevelFolder {
  id: number;
  name: string;
  grade_level?: string;
}

export default function LevelScopePicker({
  folders,
  rootFolderIds,
  value,
  onChange,
}: {
  folders: LevelFolder[];
  rootFolderIds: number[];
  value: number;
  onChange: (rootId: number) => void;
}) {
  const roots = rootFolderIds
    .map((id) => folders.find((folder) => folder.id === id))
    .filter((folder): folder is LevelFolder => Boolean(folder));

  if (roots.length < 2) return null;

  return (
    <div className="flex justify-center">
      <GlassSegmentedControl
        value={String(value)}
        onChange={(id) => onChange(Number(id))}
        options={roots.map((root) => ({
          id: String(root.id),
          label: root.grade_level ? getCatalogLevelLabel(root.grade_level) : root.name,
        }))}
        size="md"
        className="max-w-full"
      />
    </div>
  );
}
