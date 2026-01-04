import { useState, useCallback, useRef } from "react";

export interface ClickPoint {
  id: string;
  frameIndex: number;
  timestamp: number;
  x: number;
  y: number;
  frameUrl: string;
}

export interface MaskData {
  preview: string; // base64 image
  maskUrl?: string;
  predictionId?: string;
}

export interface ObjectSelectionState {
  clickPoints: ClickPoint[];
  maskData: MaskData | null;
  selectedFrameIndex: number | null;
  selectedObject: ClickPoint | null;
  pendingAction: "remove" | "extract" | null;
}

const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

export function useObjectSelection(initialState?: Partial<ObjectSelectionState>) {
  const defaultState: ObjectSelectionState = {
    clickPoints: [],
    maskData: null,
    selectedFrameIndex: null,
    selectedObject: null,
    pendingAction: null,
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
      maskData: null,
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
  };
}

