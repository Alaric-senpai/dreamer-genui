/** Observer-pattern event bus for any event type. */
export class EventBus<T> {
  private listeners = new Set<(event: T) => void>();

  /** Subscribe to events. Returns an unsubscribe function. */
  subscribe(fn: (event: T) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Emit an event to all subscribers. */
  emit(event: T): void {
    for (const fn of this.listeners) {
      fn(event);
    }
  }

  /** Returns the number of subscribers. */
  get size(): number {
    return this.listeners.size;
  }
}
