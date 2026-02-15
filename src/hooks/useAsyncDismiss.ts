import { useEffect, useState } from "react";

/**
 * Custom hook for tracking async operation completion and auto-dismissing UI.
 *
 * Pattern: When an async operation completes without error, dismiss the associated UI.
 * Tracks the "was processing" state internally to detect the transition from
 * processing → completed.
 *
 * @param isProcessing - Whether the async operation is currently in progress
 * @param error - Error from the operation (null if no error)
 * @param onDismiss - Callback to dismiss the UI when the operation succeeds
 */
export function useAsyncDismiss(
  isProcessing: boolean,
  error: string | null,
  onDismiss: () => void,
): void {
  const [wasProcessing, setWasProcessing] = useState(false);

  useEffect(() => {
    if (isProcessing) {
      setWasProcessing(true);
    } else if (wasProcessing && !error) {
      onDismiss();
      setWasProcessing(false);
    } else {
      setWasProcessing(false);
    }
  }, [isProcessing, error]);
}
