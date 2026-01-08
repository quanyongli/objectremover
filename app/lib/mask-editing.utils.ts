/**
 * 遮罩编辑工具函数
 */

import type { VisualPromptPoint, PendingMaskOperation } from "~/hooks/useObjectSelection";

/**
 * 归一化坐标转换为像素坐标
 */
export function normalizeToPixel(
  normalizedX: number,
  normalizedY: number,
  imageWidth: number,
  imageHeight: number
): [number, number] {
  return [
    Math.round(normalizedX * imageWidth),
    Math.round(normalizedY * imageHeight),
  ];
}

/**
 * 像素坐标转换为归一化坐标
 */
export function pixelToNormalize(
  pixelX: number,
  pixelY: number,
  imageWidth: number,
  imageHeight: number
): [number, number] {
  return [
    Math.max(0, Math.min(1, pixelX / imageWidth)),
    Math.max(0, Math.min(1, pixelY / imageHeight)),
  ];
}

/**
 * 计算帧索引
 */
export function getFrameIndex(timestamp: number, fps: number = 30): number {
  return Math.floor(timestamp * fps);
}

/**
 * 检测点击位置是否在遮罩内（支持视频和图片）
 */
export async function isClickInMask(
  clickX: number, // 像素坐标（基于原图尺寸）
  clickY: number, // 像素坐标（基于原图尺寸）
  maskPreview: string, // 遮罩预览图 URL、base64 或视频 URL
  originalWidth?: number, // 原图宽度（用于坐标缩放）
  originalHeight?: number // 原图高度（用于坐标缩放）
): Promise<boolean> {
  try {
    console.log("🔍 isClickInMask called:", {
      clickX,
      clickY,
      originalWidth,
      originalHeight,
      maskPreviewType: maskPreview.startsWith('data:') ? 'base64' : 'url',
      maskPreviewUrl: maskPreview.substring(0, 100) + '...',
    });

    // 判断是否是视频 URL
    // 检查多种视频 URL 格式
    const isVideo = 
      maskPreview.includes('.mp4') || // 包含 .mp4 扩展名
      maskPreview.includes('/output.mp4') || // SAM3 输出格式
      maskPreview.includes('replicate.delivery') || // Replicate 域名
      maskPreview.includes('replicate.com') || // Replicate 域名
      (maskPreview.startsWith('http') && !maskPreview.startsWith('data:image')); // HTTP URL 但不是 base64 图片
    
    console.log("🎬 Video detection result:", { isVideo, maskPreview: maskPreview.substring(0, 100) });

    if (isVideo) {
      // 如果是视频，需要先提取第一帧
      console.log("📹 Treating as video, extracting first frame...");
      return await isClickInMaskVideo(clickX, clickY, maskPreview, originalWidth, originalHeight);
    } else {
      // 如果是图片，直接检测
      console.log("🖼️ Treating as image, checking directly...");
      return await isClickInMaskImage(clickX, clickY, maskPreview, originalWidth, originalHeight);
    }
  } catch (error) {
    console.error("❌ Failed to check if click is in mask:", error);
    return false;
  }
}

/**
 * 从视频 URL 检测点击是否在遮罩内
 */
async function isClickInMaskVideo(
  clickX: number,
  clickY: number,
  videoUrl: string,
  originalWidth?: number,
  originalHeight?: number
): Promise<boolean> {
  console.log("🎥 isClickInMaskVideo called:", { clickX, clickY, originalWidth, originalHeight, videoUrl: videoUrl.substring(0, 100) });

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = videoUrl;
    video.muted = true;
    video.preload = 'auto'; // 改为 auto，确保加载足够数据
    
    const timeout = setTimeout(() => {
      console.warn("⏱️ Video load timeout for mask detection (10s)");
      resolve(false);
    }, 10000); // 10秒超时
    
    video.onloadeddata = () => {
      console.log("✅ Video loaded, dimensions:", video.videoWidth, "x", video.videoHeight);
      try {
        video.currentTime = 0;
      } catch (e) {
        console.error("❌ Failed to set video currentTime:", e);
        clearTimeout(timeout);
        resolve(false);
      }
    };
    
    video.onseeked = () => {
      console.log("✅ Video seeked to frame 0");
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.error("❌ Failed to get canvas context");
          clearTimeout(timeout);
          resolve(false);
          return;
        }
        
        ctx.drawImage(video, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // 如果提供了原图尺寸，且视频尺寸不同，需要按比例缩放坐标
        let pixelX = Math.floor(clickX);
        let pixelY = Math.floor(clickY);
        
        if (originalWidth && originalHeight && (canvas.width !== originalWidth || canvas.height !== originalHeight)) {
          // 按比例缩放坐标
          const scaleX = canvas.width / originalWidth;
          const scaleY = canvas.height / originalHeight;
          pixelX = Math.floor(clickX * scaleX);
          pixelY = Math.floor(clickY * scaleY);
          console.log("📐 Scaling coordinates:", {
            original: { x: clickX, y: clickY },
            scaled: { x: pixelX, y: pixelY },
            scale: { x: scaleX, y: scaleY },
            originalSize: `${originalWidth}x${originalHeight}`,
            videoSize: `${canvas.width}x${canvas.height}`
          });
        }
        
        console.log("📍 Checking pixel at:", { pixelX, pixelY, canvasSize: `${canvas.width}x${canvas.height}` });
        
        // 检查坐标是否在范围内
        if (pixelX < 0 || pixelX >= canvas.width || pixelY < 0 || pixelY >= canvas.height) {
          console.warn("⚠️ Click coordinates out of bounds");
          clearTimeout(timeout);
          resolve(false);
          return;
        }
        
        const index = (pixelY * canvas.width + pixelX) * 4;
        // 检查 RGB 通道，遮罩叠加图会有明显的颜色（绿色、红色等）
        const r = imageData.data[index];
        const g = imageData.data[index + 1];
        const b = imageData.data[index + 2];
        const alpha = imageData.data[index + 3];
        
        console.log("🎨 Pixel color at click:", { r, g, b, alpha });
        
        // 遮罩区域检测：只使用颜色判断（绿色遮罩）
        // SAM3 使用绿色遮罩，遮罩区域会有明显的绿色叠加
        // 判断条件：
        // 1. 绿色通道明显高于红色和蓝色通道（绿色占主导）
        // 2. 绿色值足够大，或者绿色相对于红色/蓝色的优势足够明显
        const greenDominance = g > r && g > b; // 绿色占主导
        const greenAbsoluteThreshold = g > 80; // 绿色绝对阈值（降低到 80，避免漏检）
        const greenRelativeAdvantage = (g - r) > 30 && (g - b) > 30; // 绿色相对优势（比红色和蓝色都大 30 以上）
        const isMasked = greenDominance && (greenAbsoluteThreshold || greenRelativeAdvantage);
        
        console.log("🔍 Mask detection details:", {
          greenDominance,
          greenAbsoluteThreshold,
          greenRelativeAdvantage,
          greenValue: g,
          redValue: r,
          blueValue: b,
          greenRedDiff: g - r,
          greenBlueDiff: g - b,
          isMasked
        });
        console.log(isMasked ? "✅ Click is IN mask" : "❌ Click is NOT in mask");
        
        clearTimeout(timeout);
        resolve(isMasked);
      } catch (error) {
        console.error("❌ Error extracting frame from video:", error);
        clearTimeout(timeout);
        resolve(false);
      }
    };
    
    video.onerror = (e) => {
      console.error("❌ Failed to load video for mask detection:", e);
      clearTimeout(timeout);
      resolve(false);
    };
  });
}

/**
 * 从图片 URL 检测点击是否在遮罩内
 */
async function isClickInMaskImage(
  clickX: number,
  clickY: number,
  imageUrl: string,
  originalWidth?: number,
  originalHeight?: number
): Promise<boolean> {
  console.log("🖼️ isClickInMaskImage called:", { clickX, clickY, originalWidth, originalHeight, imageUrl: imageUrl.substring(0, 100) });

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = imageUrl;

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.warn("⏱️ Image load timeout (10s)");
      reject(new Error("Image load timeout"));
    }, 10000);
    
    img.onload = () => {
      console.log("✅ Image loaded, dimensions:", img.width, "x", img.height);
      clearTimeout(timeout);
      resolve();
    };
    img.onerror = (e) => {
      console.error("❌ Failed to load mask image:", e);
      clearTimeout(timeout);
      reject(new Error("Failed to load mask image"));
    };
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error("❌ Failed to get canvas context");
    return false;
  }

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // 如果提供了原图尺寸，且遮罩图片尺寸不同，需要按比例缩放坐标
  let pixelX = Math.floor(clickX);
  let pixelY = Math.floor(clickY);
  
  if (originalWidth && originalHeight && (img.width !== originalWidth || img.height !== originalHeight)) {
    // 按比例缩放坐标
    const scaleX = img.width / originalWidth;
    const scaleY = img.height / originalHeight;
    pixelX = Math.floor(clickX * scaleX);
    pixelY = Math.floor(clickY * scaleY);
    console.log("📐 Scaling coordinates:", {
      original: { x: clickX, y: clickY },
      scaled: { x: pixelX, y: pixelY },
      scale: { x: scaleX, y: scaleY },
      originalSize: `${originalWidth}x${originalHeight}`,
      maskSize: `${img.width}x${img.height}`
    });
  }

  console.log("📍 Checking pixel at:", { pixelX, pixelY, canvasSize: `${canvas.width}x${canvas.height}` });

  // 检查坐标是否在范围内
  if (pixelX < 0 || pixelX >= canvas.width || pixelY < 0 || pixelY >= canvas.height) {
    console.warn("⚠️ Click coordinates out of bounds");
    return false;
  }

  const index = (pixelY * canvas.width + pixelX) * 4;
  const r = imageData.data[index];
  const g = imageData.data[index + 1];
  const b = imageData.data[index + 2];
  const alpha = imageData.data[index + 3];

  console.log("🎨 Pixel color at click:", { r, g, b, alpha });

  // 遮罩区域检测：只使用颜色判断（绿色遮罩）
  // 注意：base64 图片中所有像素的 alpha 都是 255，所以不能用 alpha 来判断
  // SAM3 使用绿色遮罩，遮罩区域会有明显的绿色叠加
  // 判断条件：
  // 1. 绿色通道明显高于红色和蓝色通道（绿色占主导）
  // 2. 绿色值足够大，或者绿色相对于红色/蓝色的优势足够明显
  const greenDominance = g > r && g > b; // 绿色占主导
  const greenAbsoluteThreshold = g > 80; // 绿色绝对阈值（降低到 80，避免漏检）
  const greenRelativeAdvantage = (g - r) > 30 && (g - b) > 30; // 绿色相对优势（比红色和蓝色都大 30 以上）
  const isMasked = greenDominance && (greenAbsoluteThreshold || greenRelativeAdvantage);
  
  console.log("🔍 Mask detection details:", {
    greenDominance,
    greenAbsoluteThreshold,
    greenRelativeAdvantage,
    greenValue: g,
    redValue: r,
    blueValue: b,
    greenRedDiff: g - r,
    greenBlueDiff: g - b,
    isMasked
  });
  console.log(isMasked ? "✅ Click is IN mask" : "❌ Click is NOT in mask");

  return isMasked;
}

/**
 * 找到点击位置对应的点
 */
export function findClickedPoint(
  clickX: number, // 像素坐标
  clickY: number, // 像素坐标
  visualPromptPoints: VisualPromptPoint[],
  tolerance: number = 100 // 像素容差
): VisualPromptPoint | null {
  let closestPoint: VisualPromptPoint | null = null;
  let minDistance = Infinity;

  for (const point of visualPromptPoints) {
    const distance = Math.sqrt(
      Math.pow(clickX - point.x, 2) + Math.pow(clickY - point.y, 2)
    );
    if (distance < tolerance && distance < minDistance) {
      minDistance = distance;
      closestPoint = point;
    }
  }

  return closestPoint;
}

/**
 * 构建 visual_prompt JSON 字符串
 */
export function buildVisualPrompt(
  visualPromptPoints: VisualPromptPoint[]
): string | undefined {
  if (!visualPromptPoints || visualPromptPoints.length === 0) {
    return undefined;
  }

  const points = visualPromptPoints.map((p) => [p.x, p.y]);
  const labels = visualPromptPoints.map((p) => p.label);
  const frameIndex = visualPromptPoints[0]?.frameIndex ?? 0;

  return JSON.stringify({
    points,
    labels,
    frame_index: frameIndex,
  });
}

/**
 * 获取 Canvas 点击的归一化坐标
 * 考虑缩放和平移
 */
export function getNormalizedClickCoordinates(
  e: React.MouseEvent<HTMLDivElement>,
  containerRect: DOMRect,
  imgRect: DOMRect | null,
  zoomScale: number,
  panX: number,
  panY: number,
  imageWidth: number,
  imageHeight: number
): [number, number] | null {
  if (!imgRect) return null;

  const clickX = e.clientX - containerRect.left;
  const clickY = e.clientY - containerRect.top;

  // 考虑缩放和平移
  const imgX =
    (clickX -
      (containerRect.width - imgRect.width) / 2 -
      panX / zoomScale) /
    zoomScale;
  const imgY =
    (clickY -
      (containerRect.height - imgRect.height) / 2 -
      panY / zoomScale) /
    zoomScale;

  // 归一化
  const normalizedX = Math.max(0, Math.min(1, imgX / imgRect.width));
  const normalizedY = Math.max(0, Math.min(1, imgY / imgRect.height));

  return [normalizedX, normalizedY];
}

/**
 * 生成唯一的点 ID
 */
export function generatePointId(): string {
  return `point-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 从遮罩图片中采样一些点（用于保留其他对象）
 * 采样策略：在遮罩区域中均匀采样，但排除点击位置附近的区域
 */
export async function sampleMaskPoints(
  maskPreview: string, // 遮罩预览图 URL 或 base64
  excludeX: number, // 要排除的 X 坐标
  excludeY: number, // 要排除的 Y 坐标
  excludeRadius: number = 150, // 排除半径（像素）
  sampleCount: number = 5, // 采样点数
  imageWidth: number,
  imageHeight: number
): Promise<Array<{ x: number; y: number }>> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = maskPreview;

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // 如果遮罩图片尺寸和原图尺寸不同，需要缩放排除坐标
        let scaledExcludeX = excludeX;
        let scaledExcludeY = excludeY;
        if (img.width !== imageWidth || img.height !== imageHeight) {
          const scaleX = img.width / imageWidth;
          const scaleY = img.height / imageHeight;
          scaledExcludeX = Math.floor(excludeX * scaleX);
          scaledExcludeY = Math.floor(excludeY * scaleY);
        }

        // 收集所有遮罩区域的点（排除点击位置附近的区域）
        const maskPoints: Array<{ x: number; y: number }> = [];
        const step = Math.max(50, Math.min(img.width, img.height) / 20); // 采样步长

        for (let y = 0; y < img.height; y += step) {
          for (let x = 0; x < img.width; x += step) {
            // 检查是否在排除区域内
            const distance = Math.sqrt(
              Math.pow(x - scaledExcludeX, 2) + Math.pow(y - scaledExcludeY, 2)
            );
            if (distance < excludeRadius) {
              continue; // 跳过排除区域
            }

            // 检查是否是遮罩区域（绿色检测）
            const index = (y * img.width + x) * 4;
            const r = imageData.data[index];
            const g = imageData.data[index + 1];
            const b = imageData.data[index + 2];

            const greenDominance = g > r && g > b;
            const greenAbsoluteThreshold = g > 80;
            const greenRelativeAdvantage = (g - r) > 30 && (g - b) > 30;
            const isMasked = greenDominance && (greenAbsoluteThreshold || greenRelativeAdvantage);

            if (isMasked) {
              // 转换回原图坐标
              let pixelX = x;
              let pixelY = y;
              if (img.width !== imageWidth || img.height !== imageHeight) {
                const scaleX = imageWidth / img.width;
                const scaleY = imageHeight / img.height;
                pixelX = Math.floor(x * scaleX);
                pixelY = Math.floor(y * scaleY);
              }
              maskPoints.push({ x: pixelX, y: pixelY });
            }
          }
        }

        // 如果采样点太多，随机选择一些
        const sampledPoints: Array<{ x: number; y: number }> = [];
        if (maskPoints.length > 0) {
          const selectedIndices = new Set<number>();
          const count = Math.min(sampleCount, maskPoints.length);
          
          while (selectedIndices.size < count) {
            const randomIndex = Math.floor(Math.random() * maskPoints.length);
            selectedIndices.add(randomIndex);
          }
          
          selectedIndices.forEach((index) => {
            sampledPoints.push(maskPoints[index]);
          });
        }

        console.log(`✅ Sampled ${sampledPoints.length} points from mask (excluding area around ${excludeX}, ${excludeY})`);
        resolve(sampledPoints);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error("Failed to load mask image"));
    };
  });
}

