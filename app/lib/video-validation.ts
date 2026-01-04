/**
 * 视频验证工具函数
 */

export interface VideoMetadata {
  duration: number; // 秒
  width: number;
  height: number;
  frameRate?: number; // fps
  fileSize: number; // 字节
  mimeType: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: VideoMetadata;
}

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_DURATION = 300; // 300秒
// 分辨率限制：支持横屏 1920x1080 和竖屏 1080x1920
const MAX_LANDSCAPE_WIDTH = 1920; // 横屏最大宽度
const MAX_LANDSCAPE_HEIGHT = 1080; // 横屏最大高度
const MAX_PORTRAIT_WIDTH = 1080; // 竖屏最大宽度
const MAX_PORTRAIT_HEIGHT = 1920; // 竖屏最大高度
const MAX_FRAME_RATE = 60; // fps
const ALLOWED_FORMATS = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.webm', '.avi'];

/**
 * 验证文件格式
 */
export function validateFileFormat(file: File): { valid: boolean; error?: string } {
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  
  // 检查扩展名
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `不支持的文件格式。支持的格式：${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  // 检查 MIME 类型
  if (file.type && !ALLOWED_FORMATS.some(format => file.type.includes(format.split('/')[1]))) {
    // 如果 MIME 类型不匹配但扩展名匹配，给出警告但允许继续
    return { valid: true };
  }

  return { valid: true };
}

/**
 * 验证文件大小
 */
export function validateFileSize(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `文件大小超过限制。最大 ${maxSizeMB}MB，当前文件 ${fileSizeMB}MB`,
    };
  }
  return { valid: true };
}

/**
 * 验证视频时长
 */
export function validateDuration(duration: number): { valid: boolean; error?: string } {
  if (duration > MAX_DURATION) {
    const maxMinutes = Math.floor(MAX_DURATION / 60);
    const maxSeconds = MAX_DURATION % 60;
    const fileMinutes = Math.floor(duration / 60);
    const fileSeconds = Math.floor(duration % 60);
    return {
      valid: false,
      error: `视频时长超过限制。最大 ${maxMinutes}分${maxSeconds}秒，当前视频 ${fileMinutes}分${fileSeconds}秒`,
    };
  }
  return { valid: true };
}

/**
 * 验证视频分辨率
 * 支持横屏（1920x1080）和竖屏（1080x1920）
 */
export function validateResolution(width: number, height: number): { valid: boolean; error?: string } {
  const isLandscape = width >= height; // 横屏或正方形
  
  if (isLandscape) {
    // 横屏：检查宽度不超过1920，高度不超过1080
    if (width > MAX_LANDSCAPE_WIDTH || height > MAX_LANDSCAPE_HEIGHT) {
      return {
        valid: false,
        error: `视频分辨率超过限制。横屏视频最大 ${MAX_LANDSCAPE_WIDTH}x${MAX_LANDSCAPE_HEIGHT}，当前视频 ${width}x${height}`,
      };
    }
  } else {
    // 竖屏：检查宽度不超过1080，高度不超过1920
    if (width > MAX_PORTRAIT_WIDTH || height > MAX_PORTRAIT_HEIGHT) {
      return {
        valid: false,
        error: `视频分辨率超过限制。竖屏视频最大 ${MAX_PORTRAIT_WIDTH}x${MAX_PORTRAIT_HEIGHT}，当前视频 ${width}x${height}`,
      };
    }
  }
  
  return { valid: true };
}

/**
 * 验证视频帧率
 */
export function validateFrameRate(frameRate: number): { valid: boolean; error?: string; warning?: string } {
  if (frameRate > MAX_FRAME_RATE) {
    return {
      valid: false,
      error: `视频帧率超过限制。最大 ${MAX_FRAME_RATE}fps，当前视频 ${frameRate.toFixed(2)}fps`,
    };
  }
  if (frameRate > 30) {
    return {
      valid: true,
      warning: `视频帧率较高（${frameRate.toFixed(2)}fps），处理时间可能较长`,
    };
  }
  return { valid: true };
}

/**
 * 获取视频元数据（包括帧率）
 * 注意：浏览器 API 无法直接获取帧率，这里返回 undefined
 * 实际帧率验证需要在服务端使用 ffprobe 等工具
 */
export async function getVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    video.onloadedmetadata = () => {
      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;

      URL.revokeObjectURL(url);
      
      resolve({
        duration: isFinite(duration) ? duration : 0,
        width,
        height,
        frameRate: undefined, // 浏览器无法直接获取帧率，需要在服务端验证
        fileSize: file.size,
        mimeType: file.type,
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法读取视频元数据'));
    };

    video.src = url;
  });
}

/**
 * 完整验证视频文件
 */
export async function validateVideo(file: File): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. 验证文件格式
  const formatCheck = validateFileFormat(file);
  if (!formatCheck.valid) {
    errors.push(formatCheck.error!);
    return { valid: false, errors, warnings };
  }

  // 2. 验证文件大小
  const sizeCheck = validateFileSize(file);
  if (!sizeCheck.valid) {
    errors.push(sizeCheck.error!);
    return { valid: false, errors, warnings };
  }

  // 3. 获取并验证视频元数据
  try {
    const metadata = await getVideoMetadata(file);

    // 验证时长
    const durationCheck = validateDuration(metadata.duration);
    if (!durationCheck.valid) {
      errors.push(durationCheck.error!);
    }

    // 验证分辨率
    const resolutionCheck = validateResolution(metadata.width, metadata.height);
    if (!resolutionCheck.valid) {
      errors.push(resolutionCheck.error!);
    }

    // 验证帧率（如果有，浏览器无法直接获取，需要在服务端验证）
    // 这里暂时跳过帧率验证，实际应用中应该在服务端使用 ffprobe 验证
    if (metadata.frameRate !== undefined && metadata.frameRate > 0) {
      const frameRateCheck = validateFrameRate(metadata.frameRate);
      if (!frameRateCheck.valid) {
        errors.push(frameRateCheck.error!);
      } else if (frameRateCheck.warning) {
        warnings.push(frameRateCheck.warning);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : '无法读取视频元数据');
    return { valid: false, errors, warnings };
  }
}

/**
 * 生成视频预览（第一帧作为缩略图）
 */
export async function generateVideoPreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      video.currentTime = 0.1; // 跳到0.1秒，避免黑屏
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('无法创建画布上下文'));
        return;
      }
      ctx.drawImage(video, 0, 0);
      const previewUrl = canvas.toDataURL('image/jpeg', 0.8);
      URL.revokeObjectURL(url);
      resolve(previewUrl);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法生成视频预览'));
    };

    video.src = url;
  });
}

