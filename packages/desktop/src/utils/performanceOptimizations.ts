/**
 * Performance Optimization Utilities for Test Case Driven Automation
 * 
 * This module provides performance optimizations for handling large scripts
 * with many steps and actions in the UI. It includes:
 * - Virtual list helpers for rendering large step lists
 * - Memoization utilities for expensive computations
 * - Debounced update handlers for rapid changes
 * - Performance monitoring utilities
 * 
 * Requirements: 1.5, 4.2, 5.1
 */

import { TestStep, ActionWithId, TestScript } from '../types/testCaseDriven.types';

/**
 * Configuration for virtual list rendering
 */
export interface VirtualListConfig {
  itemHeight: number;
  overscan: number;
  containerHeight: number;
}

/**
 * Calculate visible range for virtual list rendering
 * 
 * @param scrollTop - Current scroll position
 * @param config - Virtual list configuration
 * @param totalItems - Total number of items
 * @returns Object with start and end indices
 */
export function calculateVisibleRange(
  scrollTop: number,
  config: VirtualListConfig,
  totalItems: number
): { start: number; end: number; offsetY: number } {
  const { itemHeight, overscan, containerHeight } = config;
  
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const end = Math.min(totalItems, start + visibleCount + overscan * 2);
  const offsetY = start * itemHeight;
  
  return { start, end, offsetY };
}

/**
 * Create a debounced function for handling rapid updates
 * 
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Create a throttled function for rate-limiting updates
 * 
 * @param fn - Function to throttle
 * @param limit - Minimum time between calls in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = limit - (now - lastCall);
    
    if (remaining <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastCall = now;
      fn(...args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn(...args);
      }, remaining);
    }
  };
}

/**
 * Memoization cache for expensive computations
 */
class MemoCache<K, V> {
  private cache: Map<K, { value: V; timestamp: number }> = new Map();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = 1000, ttl: number = 60000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.value;
  }

  set(key: K, value: V): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// Global caches for common operations
const stepFilterCache = new MemoCache<string, ActionWithId[]>(500, 30000);
const stepCountCache = new MemoCache<string, number>(1000, 60000);

/**
 * Memoized step filtering with cache
 * 
 * @param step - Test step to filter actions for
 * @param actionPool - Pool of all actions
 * @returns Filtered actions for the step
 */
export function memoizedFilterActionsForStep(
  step: TestStep,
  actionPool: Record<string, ActionWithId>
): ActionWithId[] {
  const cacheKey = `${step.id}:${step.action_ids.join(',')}`;
  
  const cached = stepFilterCache.get(cacheKey);
  if (cached) return cached;
  
  const filtered = step.action_ids
    .map(actionId => actionPool[actionId])
    .filter((action): action is ActionWithId => action !== undefined)
    .sort((a, b) => a.timestamp - b.timestamp);
  
  stepFilterCache.set(cacheKey, filtered);
  return filtered;
}

/**
 * Memoized action count for a step
 * 
 * @param step - Test step
 * @param actionPool - Pool of all actions
 * @returns Number of valid actions
 */
export function memoizedGetStepActionCount(
  step: TestStep,
  actionPool: Record<string, ActionWithId>
): number {
  const cacheKey = `count:${step.id}:${step.action_ids.length}`;
  
  const cached = stepCountCache.get(cacheKey);
  if (cached !== undefined) return cached;
  
  const count = step.action_ids.filter(id => actionPool[id] !== undefined).length;
  stepCountCache.set(cacheKey, count);
  return count;
}

/**
 * Clear all performance caches
 */
export function clearPerformanceCaches(): void {
  stepFilterCache.clear();
  stepCountCache.clear();
}

/**
 * Performance metrics collector
 */
export interface PerformanceMetrics {
  operationName: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics: number = 1000;

  record(operationName: string, duration: number, metadata?: Record<string, any>): void {
    if (this.metrics.length >= this.maxMetrics) {
      this.metrics.shift();
    }
    
    this.metrics.push({
      operationName,
      duration,
      timestamp: Date.now(),
      metadata
    });
  }

  measure<T>(operationName: string, fn: () => T, metadata?: Record<string, any>): T {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    this.record(operationName, duration, metadata);
    return result;
  }

  async measureAsync<T>(
    operationName: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    this.record(operationName, duration, metadata);
    return result;
  }

  getMetrics(operationName?: string): PerformanceMetrics[] {
    if (operationName) {
      return this.metrics.filter(m => m.operationName === operationName);
    }
    return [...this.metrics];
  }

  getAverageDuration(operationName: string): number {
    const ops = this.metrics.filter(m => m.operationName === operationName);
    if (ops.length === 0) return 0;
    return ops.reduce((sum, m) => sum + m.duration, 0) / ops.length;
  }

  getSummary(): Record<string, { count: number; avgDuration: number; maxDuration: number }> {
    const summary: Record<string, { count: number; totalDuration: number; maxDuration: number }> = {};
    
    for (const metric of this.metrics) {
      if (!summary[metric.operationName]) {
        summary[metric.operationName] = { count: 0, totalDuration: 0, maxDuration: 0 };
      }
      summary[metric.operationName].count++;
      summary[metric.operationName].totalDuration += metric.duration;
      summary[metric.operationName].maxDuration = Math.max(
        summary[metric.operationName].maxDuration,
        metric.duration
      );
    }
    
    const result: Record<string, { count: number; avgDuration: number; maxDuration: number }> = {};
    for (const [name, data] of Object.entries(summary)) {
      result[name] = {
        count: data.count,
        avgDuration: data.totalDuration / data.count,
        maxDuration: data.maxDuration
      };
    }
    
    return result;
  }

  clear(): void {
    this.metrics = [];
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Calculate script complexity metrics
 * 
 * @param script - Test script to analyze
 * @returns Complexity metrics
 */
export function calculateScriptComplexity(script: TestScript): {
  totalSteps: number;
  totalActions: number;
  avgActionsPerStep: number;
  maxActionsPerStep: number;
  complexityScore: number;
  estimatedExecutionTime: number;
} {
  const totalSteps = script.steps.length;
  const totalActions = Object.keys(script.action_pool).length;
  
  const actionsPerStep = script.steps.map(step => step.action_ids.length);
  const avgActionsPerStep = totalSteps > 0 
    ? actionsPerStep.reduce((sum, count) => sum + count, 0) / totalSteps 
    : 0;
  const maxActionsPerStep = actionsPerStep.length > 0 
    ? Math.max(...actionsPerStep) 
    : 0;
  
  // Complexity score based on steps and actions
  const complexityScore = totalSteps * avgActionsPerStep;
  
  // Estimated execution time (100ms per action average)
  const estimatedExecutionTime = totalActions * 0.1;
  
  return {
    totalSteps,
    totalActions,
    avgActionsPerStep,
    maxActionsPerStep,
    complexityScore,
    estimatedExecutionTime
  };
}

/**
 * Batch update handler for efficient state updates
 */
export class BatchUpdateHandler<T> {
  private pendingUpdates: T[] = [];
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;
  private flushCallback: (updates: T[]) => void;
  private batchSize: number;
  private flushDelay: number;

  constructor(
    flushCallback: (updates: T[]) => void,
    batchSize: number = 10,
    flushDelay: number = 16 // ~60fps
  ) {
    this.flushCallback = flushCallback;
    this.batchSize = batchSize;
    this.flushDelay = flushDelay;
  }

  add(update: T): void {
    this.pendingUpdates.push(update);
    
    if (this.pendingUpdates.length >= this.batchSize) {
      this.flush();
    } else if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => this.flush(), this.flushDelay);
    }
  }

  flush(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    
    if (this.pendingUpdates.length > 0) {
      const updates = [...this.pendingUpdates];
      this.pendingUpdates = [];
      this.flushCallback(updates);
    }
  }

  clear(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    this.pendingUpdates = [];
  }

  get pendingCount(): number {
    return this.pendingUpdates.length;
  }
}

/**
 * Check if a script is considered "large" and may need performance optimizations
 * 
 * @param script - Test script to check
 * @returns True if script is large
 */
export function isLargeScript(script: TestScript): boolean {
  const LARGE_STEP_THRESHOLD = 100;
  const LARGE_ACTION_THRESHOLD = 500;
  
  return script.steps.length > LARGE_STEP_THRESHOLD ||
         Object.keys(script.action_pool).length > LARGE_ACTION_THRESHOLD;
}

/**
 * Get recommended virtual list configuration based on script size
 * 
 * @param script - Test script
 * @param containerHeight - Height of the container
 * @returns Virtual list configuration
 */
export function getVirtualListConfig(
  script: TestScript,
  containerHeight: number
): VirtualListConfig {
  const isLarge = isLargeScript(script);
  
  return {
    itemHeight: 60, // Standard step item height
    overscan: isLarge ? 3 : 5, // Less overscan for large scripts
    containerHeight
  };
}
