import React from "react";
import { useNavigate } from "react-router";
import { VideoUploader } from "~/components/video/VideoUploader";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "~/components/ui/button";

export async function loader({ request }: { request: Request }) {
  try {
    // Import auth only in server-side loader
    const { auth } = await import("~/lib/auth.server");
    const session = await auth.api?.getSession?.({ headers: request.headers });
    const uid: string | undefined = session?.user?.id || session?.session?.userId;
    if (!uid) {
      return new Response(null, {
        status: 302,
        headers: { Location: "/login" },
      });
    }
    return null;
  } catch {
    return new Response(null, { status: 302, headers: { Location: "/login" } });
  }
}

export default function UploadPage() {
  const navigate = useNavigate();

  const handleUploadSuccess = (asset: {
    id: string;
    name: string;
    mediaUrlRemote: string;
    width: number;
    height: number;
    durationInSeconds: number;
  }) => {
    console.log('📤 Upload success callback, asset:', asset);
    toast.success("视频上传成功！");
    // 导航到对象选择页面
    if (asset && asset.id) {
      // 使用 window.location 确保完全导航，避免可能的导航问题
      setTimeout(() => {
        console.log('🚀 Navigating to:', `/object-selection/${asset.id}`);
        window.location.href = `/object-selection/${asset.id}`;
      }, 500);
    } else {
      console.error('❌ Asset ID missing:', asset);
      toast.error("上传成功，但无法获取视频ID");
      setTimeout(() => {
        navigate("/dashboard");
      }, 1500);
    }
  };

  const handleUploadError = (error: string) => {
    toast.error(error);
  };

  return (
    <div className="min-h-screen w-full bg-background">
      {/* Header */}
      <header className="h-12 border-b border-border/50 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center px-4 sm:px-6 sticky top-0 z-50">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">上传视频</h1>
          <p className="text-muted-foreground">
            上传您的视频文件，我们将自动验证格式、大小和参数
          </p>
        </div>

        <VideoUploader
          onUploadSuccess={handleUploadSuccess}
          onUploadError={handleUploadError}
        />

        {/* 上传说明 */}
        <div className="mt-8 p-4 rounded-lg bg-muted/50 border border-border">
          <h3 className="font-medium mb-2">上传要求：</h3>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>支持格式：MP4、MOV、WebM、AVI</li>
            <li>文件大小：最大 500MB</li>
            <li>视频时长：最大 300 秒（5 分钟）</li>
            <li>分辨率：横屏最大 1920×1080，竖屏最大 1080×1920</li>
            <li>帧率：最大 60fps</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

