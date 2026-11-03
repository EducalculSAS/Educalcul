"use client";
/* eslint-disable @next/next/no-img-element -- extrait d'un composant qui affiche des images à adresse libre */
import GlassIconButton from "@/components/ui/GlassIconButton";
import { Trash2, Image as ImageIcon } from "lucide-react";
import { type Block, type Page } from "@/components/admin/ExerciseBuilder";

type ImageBlockEditorProps = {
  block: Block;
  updateBlock: (pageId: string, blockId: string, updates: Partial<Block>) => void;
  page: Page;
  uploadMedia: (pageId: string, blockId: string, file: File) => Promise<void>;
  uploadingBlockId: string | null;
  uploadErrorBlockId: string | null;
};

export default function ImageBlockEditor(props: ImageBlockEditorProps) {
  const { block, updateBlock, page, uploadMedia, uploadingBlockId, uploadErrorBlockId } = props;
  return (
    <div className="space-y-2">
    {block.content ? (
      <div className="relative inline-block">
        {block.mediaType === "video" ? (
          <video src={block.content} controls className="h-40 rounded-lg border bg-black" />
        ) : block.mediaType === "audio" ? (
          <audio src={block.content} controls className="w-64" />
        ) : (
          <img src={block.content} alt="Preview" className="h-40 object-contain border rounded-lg bg-gray-50" />
        )}
        <GlassIconButton
          icon={Trash2}
          onClick={() => updateBlock(page.id, block.id, { content: "", mediaType: undefined })}
          color="red"
          size="sm"
          aria-label="Retirer le fichier"
          className="absolute -top-2 -right-2"
        />
      </div>
    ) : (
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) uploadMedia(page.id, block.id, file);
        }}
        className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[rgba(197,161,72,0.4)] rounded-lg py-8 cursor-pointer hover:border-[var(--greek-blue)] hover:bg-[var(--greek-blue)]/5 transition-colors text-center"
      >
        <ImageIcon size={22} className="text-gray-400" />
        <span className="text-sm text-gray-500">
          {uploadingBlockId === block.id
            ? "Envoi en cours..."
            : "Clique pour choisir un fichier, ou glisse-le ici"}
        </span>
        <span className="text-xs text-gray-400">Image, vidéo (mp4/webm) ou audio (mp3/wav)</span>
        <input
          type="file"
          accept="image/*,video/mp4,video/webm,audio/mpeg,audio/wav,audio/ogg"
          className="hidden"
          disabled={uploadingBlockId === block.id}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadMedia(page.id, block.id, file);
          }}
        />
      </label>
    )}
    {uploadErrorBlockId === block.id && (
      <p className="text-xs text-red-500">Échec de l&apos;envoi du fichier. Réessaie (max 20 Mo).</p>
    )}
  </div>
  );
}
