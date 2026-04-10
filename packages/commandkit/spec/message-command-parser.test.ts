import { Collection, ApplicationCommandOptionType, Message } from 'discord.js';
import { describe, expect, test, vi } from 'vitest';
import { MessageCommandParser } from '../src/app/commands/MessageCommandParser';

function createMessage(content: string) {
  return {
    attachments: new Collection(),
    content,
    guild: null,
    mentions: {
      channels: new Collection(),
      roles: new Collection(),
      users: new Collection(),
    },
  } as unknown as Message;
}

describe('MessageCommandParser', () => {
  test('parses a flat prefix command with typed options', () => {
    const schemaCalls: string[] = [];
    const parser = new MessageCommandParser(
      createMessage('!ping enabled:true count:2 title:neo'),
      ['!'],
      (command) => {
        schemaCalls.push(command);

        return {
          count: ApplicationCommandOptionType.Integer,
          enabled: ApplicationCommandOptionType.Boolean,
          title: ApplicationCommandOptionType.String,
        };
      },
    );

    expect(parser.getPrefix()).toBe('!');
    expect(parser.getCommand()).toBe('ping');
    expect(parser.getSubcommand()).toBeUndefined();
    expect(parser.getSubcommandGroup()).toBeUndefined();
    expect(parser.getFullCommand()).toBe('ping');
    expect(parser.getArgs()).toEqual(['enabled:true', 'count:2', 'title:neo']);
    expect(schemaCalls).toEqual(['ping']);

    expect(parser.options.getBoolean('enabled')).toBe(true);
    expect(parser.options.getInteger('count')).toBe(2);
    expect(parser.options.getString('title')).toBe('neo');
  });

  test('throws when the message does not match the configured prefix', () => {
    const parser = new MessageCommandParser(
      createMessage('?ping'),
      ['!'],
      () => ({}),
    );

    expect(() => parser.parse()).toThrow();
  });

  test('throws when the message only contains the prefix', () => {
    const schema = vi.fn(() => ({}));
    const parser = new MessageCommandParser(createMessage('!'), ['!'], schema);

    expect(() => parser.parse()).toThrow();
    expect(schema).not.toHaveBeenCalled();
  });

  test('throws when the message only contains the prefix and whitespace', () => {
    const schema = vi.fn(() => ({}));
    const parser = new MessageCommandParser(
      createMessage('!   '),
      ['!'],
      schema,
    );

    expect(() => parser.parse()).toThrow();
    expect(schema).not.toHaveBeenCalled();
  });

  test('parses colon-delimited hierarchical prefix routes', () => {
    const schemaCalls: string[] = [];
    const parser = new MessageCommandParser(
      createMessage('!admin:moderation:ban reason:spam'),
      ['!'],
      (command) => {
        schemaCalls.push(command);

        return {
          reason: ApplicationCommandOptionType.String,
        };
      },
    );

    expect(parser.getCommand()).toBe('admin');
    expect(parser.getSubcommandGroup()).toBe('moderation');
    expect(parser.getSubcommand()).toBe('ban');
    expect(parser.getFullCommand()).toBe('admin moderation ban');
    expect(schemaCalls).toEqual(['admin moderation ban']);
    expect(parser.options.getString('reason')).toBe('spam');
  });
});
