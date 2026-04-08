import { Collection, ApplicationCommandOptionType, Message } from 'discord.js';
import { describe, expect, test } from 'vitest';
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
});
