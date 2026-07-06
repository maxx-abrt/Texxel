"use client";

import { useEffect, useRef, useState } from "react";
import Cropper from "react-cropper";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { btnOutline, btnPrimary } from "@/components/app/common";
import { cn } from "@/lib/utils";
import CropperType from "cropperjs";
import "cropperjs/dist/cropper.css";

export type ImageCropperSource = File | string | null;

export interface ImageCropperModalProps {
  open: boolean;
  source: ImageCropperSource;
  title: string;
  applyLabel: string;
  cancelLabel: string;
  zoomLabel?: string;
  resetLabel?: string;
  onClose: () => void;
  onConfirm: (croppedFile: File) => void;
}

export function ImageCropperModal({
  open,
  source,
  title,
  applyLabel,
  cancelLabel,
  zoomLabel = "Zoom",
  resetLabel = "Reset",
  onClose,
  onConfirm,
}: ImageCropperModalProps) {
  const cropperRef = useRef<CropperType | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!open) {
      setImageUrl((prev) => {
        if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    if (source instanceof File) {
      const url = URL.createObjectURL(source);
      setImageUrl(url);
    } else if (typeof source === "string" && source.trim()) {
      setImageUrl(source);
    } else {
      setImageUrl(null);
    }
  }, [open, source]);

  const handleApply = async () => {
    const cropper = cropperRef.current;
    if (!cropper) return;

    setApplying(true);
    try {
      const canvas = cropper.getCroppedCanvas({
        maxWidth: 1024,
        maxHeight: 1024,
        fillColor: "#fff",
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "high",
      });

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b: Blob | null) => resolve(b), "image/jpeg", 0.9)
      );
      if (!blob) throw new Error("Failed to crop image");

      const fileName = source instanceof File ? source.name : "cropped-image.jpg";
      const file = new File([blob], fileName.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
      onConfirm(file);
    } finally {
      setApplying(false);
    }
  };

  const handleReset = () => {
    cropperRef.current?.reset();
  };

  const handleZoom = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cropper = cropperRef.current;
    if (!cropper) return;
    const ratio = Number(e.target.value);
    cropper.zoomTo(ratio);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="relative w-full overflow-hidden rounded-xl border border-border bg-black/5">
          {imageUrl ? (
            <Cropper
              src={imageUrl}
              style={{ height: 320, width: "100%" }}
              initialAspectRatio={NaN}
              aspectRatio={NaN}
              viewMode={1}
              dragMode="move"
              autoCropArea={1}
              cropBoxResizable={true}
              cropBoxMovable={true}
              guides={true}
              center={true}
              highlight={false}
              background={true}
              zoomable={true}
              zoomOnTouch={true}
              zoomOnWheel={true}
              wheelZoomRatio={0.1}
              scalable={false}
              toggleDragModeOnDblclick={false}
              onInitialized={(instance) => {
                cropperRef.current = instance;
              }}
            />
          ) : (
            <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
              No image
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{zoomLabel}</span>
          <input
            type="range"
            min={0.1}
            max={3}
            step={0.01}
            defaultValue={1}
            onChange={handleZoom}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
          />
          <button onClick={handleReset} className={cn(btnOutline, "h-8 px-2 text-xs")}>
            {resetLabel}
          </button>
        </div>

        <DialogFooter>
          <button onClick={onClose} disabled={applying} className={btnOutline}>
            {cancelLabel}
          </button>
          <button onClick={handleApply} disabled={!imageUrl || applying} className={btnPrimary}>
            {applying ? "..." : applyLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
