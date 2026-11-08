import { describe, expect, test } from 'vitest';
import { EventBus } from '../../packages/dreamer-genui/src/core/events';
import type { UIEvent } from '../../packages/dreamer-genui/src/schema/events';

describe('EventBus', () => {
  test('subscribe emits to subscriber', () => {
    const bus = new EventBus<UIEvent>();
    const events: UIEvent[] = [];
    const unsub = bus.subscribe(e => events.push(e));
    bus.emit({ type: 'focus', nodeId: 'n1', ref: 'child-1' });
    expect(events).toHaveLength(1);
    unsub();
    bus.emit({ type: 'action', action: 'return' });
    expect(events).toHaveLength(1); // no new event after unsubscribe
  });

  test('subscribe returns unsubscribe function', () => {
    const bus = new EventBus<UIEvent>();
    const fn = bus.subscribe(() => {});
    expect(typeof fn).toBe('function');
    const prev = bus.size;
    fn();
    expect(bus.size).toBe(prev - 1);
  });

  test('multiple subscribers all receive events', () => {
    const bus = new EventBus<UIEvent>();
    const a: UIEvent[] = [];
    const b: UIEvent[] = [];
    bus.subscribe(e => a.push(e));
    bus.subscribe(e => b.push(e));
    bus.emit({ type: 'select', nodeId: 'c1', ref: 'item-2' });
    expect(a[0]?.nodeId).toBe('c1');
    expect(b[0]?.nodeId).toBe('c1');
  });

  test('size reflects subscriber count', () => {
    const bus = new EventBus<UIEvent>();
    expect(bus.size).toBe(0);
    const u1 = bus.subscribe(() => {});
    expect(bus.size).toBe(1);
    const u2 = bus.subscribe(() => {});
    expect(bus.size).toBe(2);
    u1();
    expect(bus.size).toBe(1);
  });
});
