import { afterEach, describe, expect, test, vi } from 'vitest';
import { Client, Collection } from 'discord.js';
import { CommandKit } from '../../commandkit';
import { CommandKitEventsChannel } from '../../events/CommandKitEventsChannel';
import { ParsedEvent } from '../router';
import { AppEventsHandler, EventListener, LoadedEvent } from './AppEventsHandler';

const clients: Client[] = [];

function createHandler() {
  CommandKit.instance = undefined;

  const client = new Client({ intents: [] });
  clients.push(client);

  const commandkit = new CommandKit({ client });
  commandkit.events = new CommandKitEventsChannel(commandkit);

  return {
    client,
    commandkit,
    handler: new AppEventsHandler(commandkit),
  };
}

function createLoadedEvent(
  name: string,
  listeners: EventListener[],
  namespace: string | null = null,
): LoadedEvent {
  const event: ParsedEvent = {
    event: name,
    namespace,
    path: `/events/${namespace ? `${namespace}/` : ''}${name}`,
    listeners: [],
  };

  return {
    name,
    namespace,
    event,
    listeners,
  };
}

function seedLoadedEvent(handler: AppEventsHandler, event: LoadedEvent) {
  const key = `${event.namespace ? `${event.namespace}:` : ''}${event.name}`;
  const loadedEvents = (handler as any).loadedEvents as Collection<
    string,
    LoadedEvent
  >;

  loadedEvents.set(key, event);
}

function listener(
  handler: (...args: unknown[]) => void,
  options: Partial<Pick<EventListener, 'once' | 'parallel'>> = {},
): EventListener {
  return {
    handler,
    once: options.once ?? false,
    parallel: options.parallel ?? false,
  };
}

async function flushEventHandlers() {
  await new Promise((resolve) => setImmediate(resolve));
}

afterEach(async () => {
  CommandKit.instance = undefined;

  await Promise.all(clients.splice(0).map((client) => client.destroy()));
});

describe('AppEventsHandler listener cleanup', () => {
  test('removes stale pending once wrapper when reloading mixed regular and once events', async () => {
    const { client, handler } = createHandler();
    const eventName = 'eventLifecycleTest';
    let oldRegular = 0;
    let oldOnce = 0;
    let newRegular = 0;
    let newOnce = 0;

    seedLoadedEvent(
      handler,
      createLoadedEvent(eventName, [
        listener(() => oldRegular++),
        listener(() => oldOnce++, { once: true }),
      ]),
    );

    handler.registerAllClientEvents();
    expect(client.listenerCount(eventName)).toBe(2);

    handler.unregisterAllClientListeners();

    seedLoadedEvent(
      handler,
      createLoadedEvent(eventName, [
        listener(() => newRegular++),
        listener(() => newOnce++, { once: true }),
      ]),
    );

    handler.registerAllClientEvents();

    expect(client.listenerCount(eventName)).toBe(2);

    client.emit(eventName);
    await flushEventHandlers();

    expect(oldRegular).toBe(0);
    expect(oldOnce).toBe(0);
    expect(newRegular).toBe(1);
    expect(newOnce).toBe(1);
  });

  test('removes once-only generated wrapper with exact off cleanup', () => {
    const { client, handler } = createHandler();
    const eventName = 'eventLifecycleTest';
    const offSpy = vi.spyOn(client, 'off');
    const removeAllListenersSpy = vi.spyOn(client, 'removeAllListeners');

    seedLoadedEvent(
      handler,
      createLoadedEvent(eventName, [listener(() => {}, { once: true })]),
    );

    handler.registerAllClientEvents();
    expect(client.listenerCount(eventName)).toBe(1);

    handler.unregisterAllClientListeners();

    expect(offSpy).toHaveBeenCalledWith(eventName, expect.any(Function));
    expect(removeAllListenersSpy).not.toHaveBeenCalled();
    expect(client.listenerCount(eventName)).toBe(0);
  });

  test('keeps regular-only cleanup exact-reference based', () => {
    const { client, handler } = createHandler();
    const eventName = 'eventLifecycleTest';
    const offSpy = vi.spyOn(client, 'off');
    const removeAllListenersSpy = vi.spyOn(client, 'removeAllListeners');

    seedLoadedEvent(
      handler,
      createLoadedEvent(eventName, [listener(() => {})]),
    );

    handler.registerAllClientEvents();
    expect(client.listenerCount(eventName)).toBe(1);

    handler.unregisterAllClientListeners();

    expect(offSpy).toHaveBeenCalledWith(eventName, expect.any(Function));
    expect(removeAllListenersSpy).not.toHaveBeenCalled();
    expect(client.listenerCount(eventName)).toBe(0);
  });

  test('removes namespaced once wrapper with exact off cleanup', async () => {
    const { commandkit, handler } = createHandler();
    const eventName = 'eventLifecycleTest';
    const namespace = 'testNamespace';
    let calls = 0;
    const offSpy = vi.spyOn(commandkit.events, 'off');
    const removeAllListenersSpy = vi.spyOn(
      commandkit.events,
      'removeAllListeners',
    );

    seedLoadedEvent(
      handler,
      createLoadedEvent(
        eventName,
        [listener(() => calls++, { once: true })],
        namespace,
      ),
    );

    handler.registerAllClientEvents();
    handler.unregisterAllClientListeners();

    expect(offSpy).toHaveBeenCalledWith(
      namespace,
      eventName,
      expect.any(Function),
    );
    expect(removeAllListenersSpy).not.toHaveBeenCalled();

    commandkit.events.emit(namespace, eventName);
    await flushEventHandlers();

    expect(calls).toBe(0);
  });
});
