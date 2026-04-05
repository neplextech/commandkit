import type { Client } from 'discord.js';

export default function log(client: Client<true>) {
  console.log(`Logged in as ${client.user.username}!`);
}
