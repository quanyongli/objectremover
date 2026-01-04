import { useCallback, useState } from "react";
import { Upload, Link as LinkIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

interface UploadDropzoneProps {
  onFileSelect?: (file: File) => void;
  onUrlSubmit?: (url: string) => void;
  accept?: Record<string, string[]>;
  maxSize?: number; // in MB
  className?: string;
}

export function UploadDropzone({
  onFileSelect,
  onUrlSubmit,
  accept = { "video/*": [".mp4", ".mov", ".webm", ".avi"] },
  maxSize = 500,
  className,
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      const videoFile = files.find((file) => file.type.startsWith("video/"));
      if (videoFile) {
        if (videoFile.size > maxSize * 1024 * 1024) {
          alert(`File size exceeds ${maxSize}MB limit`);
          return;
        }
        onFileSelect?.(videoFile);
      }
    },
    [onFileSelect, maxSize]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.size > maxSize * 1024 * 1024) {
          alert(`File size exceeds ${maxSize}MB limit`);
          return;
        }
        onFileSelect?.(file);
      }
    },
    [onFileSelect, maxSize]
  );

  const handleUrlSubmit = useCallback(() => {
    if (videoUrl.trim()) {
      onUrlSubmit?.(videoUrl.trim());
    }
  }, [videoUrl, onUrlSubmit]);

  const acceptString = Object.entries(accept)
    .flatMap(([mime, exts]) => exts.map((ext) => `${mime}${ext}`))
    .join(",");

  return (
    <div className={cn("w-full", className)}>
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Upload File</TabsTrigger>
          <TabsTrigger value="url">Video Link</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "relative border-2 border-dashed rounded-xl p-12 text-center transition-all",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border bg-background/50 hover:border-primary/50 hover:bg-background/80"
            )}
          >
            <input
              type="file"
              accept={acceptString}
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">
              Drag & drop video or click to browse
            </p>
            <p className="text-sm text-muted-foreground">
              MP4, MOV, WebM, AVI up to {maxSize}MB
            </p>
          </div>
        </TabsContent>

        <TabsContent value="url" className="mt-4">
          <div className="space-y-4">
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="url"
                placeholder="Paste YouTube, TikTok, or video URL here"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleUrlSubmit();
                  }
                }}
                className="pl-10 h-12 text-base"
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Support YouTube, TikTok, Douyin, and direct video URLs
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}





