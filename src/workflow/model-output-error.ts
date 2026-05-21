/**
 * Thrown when the model returns unusable output (no text block, non-JSON, etc.).
 *
 * The pure cores (runClassification/runDraft) and the parser throw THIS — a
 * plain local class with no `workflow` import — so they run anywhere, including
 * the eval harness under tsx (where `workflow`'s FatalError/RetryableError
 * resolve to undefined). The step wrappers catch it and map it to a WDK
 * FatalError (bad output is deterministic — never retry).
 */
export class ModelOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelOutputError';
  }
}
