import { useState, useCallback, useRef } from "react";

export interface ClickPoint {
  id: string;
  frameIndex: number;
  timestamp: number;
  x: number;
  y: number;
  frameUrl: string;
}

/**
 * Visual Prompt Point - 用于 SAM3 visual_prompt 的点坐标
 */
export interface VisualPromptPoint {
  id: string; // 唯一标识
  x: number; // 像素坐标 X
  y: number; // 像素坐标 Y
  normalizedX: number; // 归一化坐标 X (0-1)
  normalizedY: number; // 归一化坐标 Y (0-1)
  label: 1 | 0; // 1=包含, 0=排除
  textPrompt?: string; // 对应的文本提示（如 "dog", "mouse"）
  frameIndex: number; // 帧索引（对应视频帧）
  timestamp: number; // 时间戳（秒）
}

export interface MaskData {
  preview: string; // base64 image
  maskUrl?: string;
  predictionId?: string;
  // 新增：visual_prompt 相关
  visualPromptPoints?: VisualPromptPoint[]; // 所有点击点
  textPrompt?: string; // 合并的文本提示（如 "dog, mouse"）
  negativePrompt?: string; // 排除提示（如 "cat"）
  imageWidth?: number; // 图片宽度（用于坐标转换）
  imageHeight?: number; // 图片高度
}

/**
 * 待确认的遮罩操作
 */
export interface PendingMaskOperation {
  type: "add" | "remove";
  clickX: number; // 像素坐标
  clickY: number; // 像素坐标
  normalizedX: number; // 归一化坐标
  normalizedY: number; // 归一化坐标
  point?: VisualPromptPoint; // 如果是移除操作，指向要移除的点
  isInMask: boolean; // 点击是否在遮罩内
  frameIndex: number; // 帧索引
  timestamp: number; // 时间戳
}

export interface ObjectSelectionState {
  clickPoints: ClickPoint[];
  maskData: MaskData | null;
  selectedFrameIndex: number | null;
  selectedObject: ClickPoint | null;
  pendingAction: "remove" | "extract" | null;
  // 新增：遮罩编辑相关
  pendingMaskOperation: PendingMaskOperation | null; // 待确认的操作
  isMaskEditMode: boolean; // 是否处于遮罩编辑模式
}

const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

export function useObjectSelection(initialState?: Partial<ObjectSelectionState>) {
  const defaultState: ObjectSelectionState = {
    clickPoints: [],
    maskData: null,
    selectedFrameIndex: null,
    selectedObject: null,
    pendingAction: null,
    pendingMaskOperation: null,
    isMaskEditMode: false,
    ...initialState,
  };

  const [state, setState] = useState<ObjectSelectionState>(defaultState);
  
  // Undo/Redo stacks
  const [undoStack, setUndoStack] = useState<ObjectSelectionState[]>([]);
  const [redoStack, setRedoStack] = useState<ObjectSelectionState[]>([]);
  const isApplyingHistoryRef = useRef(false);

  // Create a snapshot of current state
  const snapshotState = useCallback(() => {
    if (isApplyingHistoryRef.current) return;
    
    setUndoStack((prev) => {
      const cloned = deepClone(state);
      const next = [...prev, cloned];
      // Cap history to last 100 states
      return next.length > 100 ? next.slice(next.length - 100) : next;
    });
    setRedoStack([]);
  }, [state]);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  const undo = useCallback(() => {
    if (!undoStack.length) return;
    
    isApplyingHistoryRef.current = true;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((s) => [...s, deepClone(state)]);
    setState(deepClone(previous));
    isApplyingHistoryRef.current = false;
  }, [undoStack, state]);

  const redo = useCallback(() => {
    if (!redoStack.length) return;
    
    isApplyingHistoryRef.current = true;
    const nextState = redoStack[redoStack.length - 1];
    setRedoStack((s) => s.slice(0, -1));
    setUndoStack((s) => [...s, deepClone(state)]);
    setState(deepClone(nextState));
    isApplyingHistoryRef.current = false;
  }, [redoStack, state]);

  // Update state with snapshot
  const updateState = useCallback((updater: (prev: ObjectSelectionState) => ObjectSelectionState) => {
    snapshotState();
    setState(updater);
  }, [snapshotState]);

  // Helper functions
  const addClickPoint = useCallback((point: ClickPoint) => {
    updateState((prev) => ({
      ...prev,
      clickPoints: [...prev.clickPoints, point],
      selectedObject: point,
    }));
  }, [updateState]);

  const removeClickPoint = useCallback((pointId: string) => {
    updateState((prev) => ({
      ...prev,
      clickPoints: prev.clickPoints.filter((p) => p.id !== pointId),
      selectedObject: prev.selectedObject?.id === pointId ? null : prev.selectedObject,
    }));
  }, [updateState]);

  const setMaskData = useCallback((maskData: MaskData | null) => {
    updateState((prev) => ({
      ...prev,
      maskData,
    }));
  }, [updateState]);

  const setSelectedFrameIndex = useCallback((index: number | null) => {
    updateState((prev) => ({
      ...prev,
      selectedFrameIndex: index,
      selectedObject: null,
      // 切换帧时不清除遮罩，保持编辑状态
      // maskData: null,
    }));
  }, [updateState]);

  const setPendingMaskOperation = useCallback((operation: PendingMaskOperation | null) => {
    updateState((prev) => ({
      ...prev,
      pendingMaskOperation: operation,
    }));
  }, [updateState]);

  const setIsMaskEditMode = useCallback((enabled: boolean) => {
    updateState((prev) => ({
      ...prev,
      isMaskEditMode: enabled,
      pendingMaskOperation: enabled ? prev.pendingMaskOperation : null,
    }));
  }, [updateState]);

  const setPendingAction = useCallback((action: "remove" | "extract" | null) => {
    updateState((prev) => ({
      ...prev,
      pendingAction: action,
    }));
  }, [updateState]);

  const clearSelection = useCallback(() => {
    updateState((prev) => ({
      ...prev,
      clickPoints: [],
      selectedObject: null,
      maskData: null,
      pendingAction: null,
    }));
  }, [updateState]);

  const reset = useCallback(() => {
    setState(defaultState);
    setUndoStack([]);
    setRedoStack([]);
  }, [defaultState]);

  return {
    state,
    updateState,
    addClickPoint,
    removeClickPoint,
    setMaskData,
    setSelectedFrameIndex,
    setPendingAction,
    clearSelection,
    reset,
    // Undo/Redo
    undo,
    redo,
    canUndo,
    canRedo,
    snapshotState,
    // 遮罩编辑
    setPendingMaskOperation,
    setIsMaskEditMode,
  };
}

// 导出类型
export type { PendingMaskOperation, VisualPromptPoint };

