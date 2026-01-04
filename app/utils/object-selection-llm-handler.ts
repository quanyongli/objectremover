// LLM handler functions for object selection operations

import type { ClickPoint, MaskData } from "~/hooks/useObjectSelection";

export interface ObjectSelectionState {
  clickPoints: ClickPoint[];
  maskData: MaskData | null;
  selectedFrameIndex: number | null;
  selectedObject: ClickPoint | null;
  pendingAction: "remove" | "extract" | null;
}

/**
 * Select an object based on natural language description
 */
export function llmSelectObject(
  objectDescription: string,
  confidence: number,
  frameIndex: number | null,
  keyFrames: Array<{ index: number; timestamp: number; url: string }>,
  onObjectSelect: (description: string, confidence: number, frameIndex: number | null) => void
) {
  if (confidence < 0.5) {
    throw new Error(`Confidence too low: ${confidence}. Minimum required: 0.5`);
  }

  // Find the best frame if not specified
  let targetFrameIndex = frameIndex;
  if (targetFrameIndex === null && keyFrames.length > 0) {
    // Use middle frame as default
    targetFrameIndex = Math.floor(keyFrames.length / 2);
  }

  onObjectSelect(objectDescription, confidence, targetFrameIndex);
  
  return {
    success: true,
    message: `Selected object "${objectDescription}" with confidence ${(confidence * 100).toFixed(1)}%`,
    frameIndex: targetFrameIndex,
  };
}

/**
 * Generate mask for selected object
 */
export function llmGenerateMask(
  clickPoint: ClickPoint | null,
  assetId: string,
  videoUrl: string,
  onGenerateMask: (clickPoint: ClickPoint) => Promise<void>
) {
  if (!clickPoint) {
    throw new Error("No object selected. Please select an object first.");
  }

  return onGenerateMask(clickPoint).then(() => ({
    success: true,
    message: "Mask generation started",
    clickPointId: clickPoint.id,
  }));
}

/**
 * Confirm action (remove or extract)
 */
export function llmConfirmAction(
  action: "remove" | "extract",
  maskData: MaskData | null,
  selectedObject: ClickPoint | null,
  onConfirm: (action: "remove" | "extract") => Promise<void>
) {
  if (!maskData || !selectedObject) {
    throw new Error("Please select an object and generate a mask first.");
  }

  return onConfirm(action).then(() => ({
    success: true,
    message: `${action === "remove" ? "Removal" : "Extraction"} task started`,
    action,
  }));
}

/**
 * Clear current selection
 */
export function llmClearSelection(
  onClear: () => void
) {
  onClear();
  return {
    success: true,
    message: "Selection cleared",
  };
}

/**
 * Get current selection status
 */
export function llmGetSelectionStatus(
  state: ObjectSelectionState
) {
  return {
    hasSelection: state.selectedObject !== null,
    hasMask: state.maskData !== null,
    clickPointsCount: state.clickPoints.length,
    selectedFrameIndex: state.selectedFrameIndex,
    pendingAction: state.pendingAction,
  };
}

