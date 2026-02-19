import { useRef, useState } from "react";
import { formatErrorMessage } from "../utils/formatError.js";

/**
 * Manages isProcessing / error state for an async operation.
 *
 * Eliminates repetitive `setIsXxx(true); try { ... } catch { setXxxError(...) } finally { setIsXxx(false) }` patterns.
 */
export function useAsyncAction<T extends unknown[]>(
  action: (...args: T) => Promise<void>,
  formatError: (err: unknown, ...args: T) => string = (err, ..._args) => formatErrorMessage(err),
): {
  isProcessing: boolean;
  error: string | null;
  execute: (...args: T) => void;
  clearError: () => void;
} {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actionRef = useRef(action);
  actionRef.current = action;
  const formatErrorRef = useRef(formatError);
  formatErrorRef.current = formatError;

  function execute(...args: T): void {
    void (async () => {
      setIsProcessing(true);
      setError(null);
      try {
        await actionRef.current(...args);
      } catch (err) {
        setError(formatErrorRef.current(err, ...args));
      } finally {
        setIsProcessing(false);
      }
    })();
  }

  return { isProcessing, error, execute, clearError: () => setError(null) };
}
