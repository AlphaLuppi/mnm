import { useState, useCallback, type DragEvent, type ReactNode } from "react";
import { Upload, Loader2 } from "lucide-react";
import { documentsApi } from "../../api/documents";

interface DocumentDropZoneProps {
  companyId: string;
  channelId: string;
  children: ReactNode;
  onUploadComplete?: (documentId: string) => void;
}

export function DocumentDropZone({
  companyId,
  channelId,
  children,
  onUploadComplete,
}: DocumentDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const dragCounterRef = { current: 0 };

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      const file = files[0];
      setIsUploading(true);

      try {
        const doc = await documentsApi.upload(companyId, file, {
          channelId,
          title: file.name,
        });
        onUploadComplete?.(doc.id);
      } catch (err) {
        console.error("[DocumentDropZone] Upload failed:", err);
      } finally {
        setIsUploading(false);
      }
    },
    [companyId, channelId, onUploadComplete],
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative flex-1 min-h-0 flex flex-col"
    >
      {children}
      {isDragging && (
        <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-10">
          <div className="text-center">
            <Upload className="h-8 w-8 mx-auto text-primary" />
            <p className="text-sm font-medium text-primary mt-2">
              Drop files to upload
            </p>
          </div>
        </div>
      )}
      {isUploading && (
        <div className="absolute bottom-4 right-4 bg-background border rounded-lg px-3 py-2 flex items-center gap-2 shadow-lg z-10">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Uploading...</span>
        </div>
      )}
    </div>
  );
}
