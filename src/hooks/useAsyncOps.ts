import { useReducer } from "react";

/**
 * Async operation names managed by this hook.
 * Each maps to an { isProcessing, error } pair.
 */
export type AsyncOpName =
  | "comment"
  | "inlineComment"
  | "reply"
  | "approve"
  | "merge"
  | "closePR"
  | "updateComment"
  | "deleteComment"
  | "react";

interface AsyncOpEntry {
  isProcessing: boolean;
  error: string | null;
}

export type AsyncOpsState = Record<AsyncOpName, AsyncOpEntry>;

type AsyncOpsAction =
  | { type: "start"; op: AsyncOpName }
  | { type: "error"; op: AsyncOpName; error: string }
  | { type: "done"; op: AsyncOpName }
  | { type: "clearError"; op: AsyncOpName };

const initialEntry: AsyncOpEntry = { isProcessing: false, error: null };

const initialState: AsyncOpsState = {
  comment: { ...initialEntry },
  inlineComment: { ...initialEntry },
  reply: { ...initialEntry },
  approve: { ...initialEntry },
  merge: { ...initialEntry },
  closePR: { ...initialEntry },
  updateComment: { ...initialEntry },
  deleteComment: { ...initialEntry },
  react: { ...initialEntry },
};

function reducer(state: AsyncOpsState, action: AsyncOpsAction): AsyncOpsState {
  switch (action.type) {
    case "start":
      return { ...state, [action.op]: { isProcessing: true, error: null } };
    case "error":
      return { ...state, [action.op]: { isProcessing: false, error: action.error } };
    case "done":
      return { ...state, [action.op]: { isProcessing: false, error: null } };
    case "clearError":
      return { ...state, [action.op]: { ...state[action.op], error: null } };
  }
}

export interface AsyncOpsActions {
  start: (op: AsyncOpName) => void;
  error: (op: AsyncOpName, error: string) => void;
  done: (op: AsyncOpName) => void;
  clearError: (op: AsyncOpName) => void;
}

/**
 * Custom hook that consolidates 9 async operation state pairs into a single useReducer.
 * Replaces 18 individual useState calls with a unified state and dispatch API.
 */
export function useAsyncOps(): [AsyncOpsState, AsyncOpsActions] {
  const [state, dispatch] = useReducer(reducer, initialState);

  const actions: AsyncOpsActions = {
    start: (op) => dispatch({ type: "start", op }),
    error: (op, error) => dispatch({ type: "error", op, error }),
    done: (op) => dispatch({ type: "done", op }),
    clearError: (op) => dispatch({ type: "clearError", op }),
  };

  return [state, actions];
}
