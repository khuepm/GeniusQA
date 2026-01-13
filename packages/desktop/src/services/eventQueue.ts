/**
 * EventQueue Service
 * 
 * Manages offline event queuing and persistence for analytics events.
 * Implements FIFO (First-In-First-Out) ordering and localStorage persistence.
 * 
 * @module services/eventQueue
 */

import { AnalyticsEvent, QueuedEvent } from '../types/analytics.types';

/**
 * Generates a unique identifier for queued events
 */
function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * EventQueue class for managing offline analytics events
 * 
 * Features:
 * - FIFO ordering for event processing
 * - localStorage persistence for app restart survival
 * - Automatic overflow handling (removes oldest events when full)
 * - Thread-safe operations
 */
export class EventQueue {
  private queue: QueuedEvent[] = [];
  private readonly maxSize: number;
  private readonly storageKey: string;

  /**
   * Creates a new EventQueue instance
   * 
   * @param maxSize - Maximum number of events to store (default: 1000)
   * @param storageKey - localStorage key for persistence (default: 'analytics_event_queue')
   */
  constructor(maxSize: number = 1000, storageKey: string = 'analytics_event_queue') {
    this.maxSize = maxSize;
    this.storageKey = storageKey;
    this.restore();
  }

  /**
   * Adds an event to the queue
   * If queue is full, removes oldest events to make room
   * 
   * @param event - The analytics event to queue
   */
  enqueue(event: AnalyticsEvent): void {
    const queuedEvent: QueuedEvent = {
      ...event,
      id: generateEventId(),
      retryCount: 0,
    };

    // Handle overflow - remove oldest events if at capacity
    while (this.queue.length >= this.maxSize) {
      this.queue.shift();
    }

    this.queue.push(queuedEvent);
    this.persist();
  }

  /**
   * Removes and returns events from the front of the queue
   * 
   * @param count - Number of events to dequeue
   * @returns Array of dequeued events
   */
  dequeue(count: number): QueuedEvent[] {
    const actualCount = Math.min(count, this.queue.length);
    const events = this.queue.splice(0, actualCount);
    this.persist();
    return events;
  }

  /**
   * Returns events from the front of the queue without removing them
   * 
   * @param count - Number of events to peek
   * @returns Array of events (copies, not references)
   */
  peek(count: number): QueuedEvent[] {
    const actualCount = Math.min(count, this.queue.length);
    return this.queue.slice(0, actualCount).map(event => ({ ...event }));
  }

  /**
   * Removes all events from the queue
   */
  clear(): void {
    this.queue = [];
    this.persist();
  }

  /**
   * Persists the queue to localStorage
   */
  persist(): void {
    try {
      const serialized = JSON.stringify(this.queue);
      localStorage.setItem(this.storageKey, serialized);
    } catch (error) {
      // Handle QuotaExceededError by reducing queue size
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        // Keep only the most recent half of events
        this.queue = this.queue.slice(-Math.floor(this.maxSize / 2));
        try {
          localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
        } catch {
          // If still failing, clear localStorage for this key
          localStorage.removeItem(this.storageKey);
        }
      }
      // Log error but don't throw - queue still works in memory
      console.error('EventQueue: Failed to persist to localStorage', error);
    }
  }

  /**
   * Restores the queue from localStorage
   */
  restore(): void {
    try {
      const serialized = localStorage.getItem(this.storageKey);
      if (serialized) {
        const parsed = JSON.parse(serialized);
        if (Array.isArray(parsed)) {
          // Validate and restore events
          this.queue = parsed.filter(this.isValidQueuedEvent);
          // Ensure we don't exceed maxSize after restore
          if (this.queue.length > this.maxSize) {
            this.queue = this.queue.slice(-this.maxSize);
          }
        }
      }
    } catch (error) {
      // If restore fails, start with empty queue
      console.error('EventQueue: Failed to restore from localStorage', error);
      this.queue = [];
    }
  }

  /**
   * Returns the current number of events in the queue
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Checks if the queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Checks if the queue is at maximum capacity
   */
  isFull(): boolean {
    return this.queue.length >= this.maxSize;
  }

  /**
   * Returns all events in the queue (for testing/debugging)
   */
  getAll(): QueuedEvent[] {
    return [...this.queue];
  }

  /**
   * Returns the maximum queue size
   */
  getMaxSize(): number {
    return this.maxSize;
  }

  /**
   * Validates that an object is a valid QueuedEvent
   */
  private isValidQueuedEvent(obj: unknown): obj is QueuedEvent {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }
    
    const event = obj as Record<string, unknown>;
    
    return (
      typeof event.id === 'string' &&
      typeof event.name === 'string' &&
      typeof event.timestamp === 'number' &&
      typeof event.sessionId === 'string' &&
      typeof event.retryCount === 'number' &&
      typeof event.params === 'object'
    );
  }
}

/**
 * Default export for convenience
 */
export default EventQueue;
