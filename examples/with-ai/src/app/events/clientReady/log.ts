import type { Client } from 'discord.js';
import { Logger } from 'commandkit/logger';

export default function log(client: Client<true>) {
  Logger.info(`Logged in as ${client.user.username}!`);
}
