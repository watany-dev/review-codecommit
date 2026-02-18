import { useEffect, useRef } from "react";

/**
 * Calls `onDismiss` when an async operation completes successfully.
 *
 * Pattern: tracks whether `isProcessing` was true, and when it transitions
 * to false with no error, invokes `onDismiss` to close the modal/UI state.
 */
export function useAsyncDismiss(
  isProcessing: boolean,
  error: string | null,
  onDismiss: () => void,
): void {
  const wasRef = useRef(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (isProcessing) {
      wasRef.current = true;
    } else if (wasRef.current && !error) {
      wasRef.current = false;
      onDismissRef.current();
    } else {
      wasRef.current = false;
    }
  }, [isProcessing, error]);
}
