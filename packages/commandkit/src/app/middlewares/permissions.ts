import { EmbedBuilder, MessageFlags } from 'discord.js';
import { getConfig } from '../../config/config';
import { Logger } from '../../logger/Logger';
import { MiddlewareContext } from '../commands/Context';
import { stopMiddlewares } from '../interrupt/signals';

export const middlewareId = crypto.randomUUID();

/**
 * @private
 * @ignore
 */
export async function beforeExecute(ctx: MiddlewareContext) {
  if (getConfig().disablePermissionsMiddleware) {
    return;
  }

  const { interaction, message, command } = ctx;

  if (interaction && !interaction.isCommand()) {
    return;
  }

  let userPermissionsRequired = command.metadata?.userPermissions ?? [];
  let botPermissionsRequired = command.metadata?.botPermissions ?? [];

  if (typeof userPermissionsRequired === 'string') {
    userPermissionsRequired = [userPermissionsRequired];
  }

  if (typeof botPermissionsRequired === 'string') {
    botPermissionsRequired = [botPermissionsRequired];
  }

  // Only perform permission validation if required
  if (!userPermissionsRequired.length && !botPermissionsRequired.length) {
    return;
  }

  if (
    (interaction && interaction.channel?.isDMBased()) ||
    (message && message.channel?.isDMBased())
  ) {
    const channel = interaction?.channel ?? message?.channel;

    const embed = new EmbedBuilder()
      .setTitle(':x: Server-only command!')
      .setDescription('This command can only be used in a server.')
      .setColor('Red');

    try {
      if (channel?.isSendable()) {
        if (interaction && interaction.isRepliable()) {
          await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await message.reply({ embeds: [embed] });
        }
      }
    } catch (error) {
      Logger.error`Could not send 'Server-only command' DM to user ${interaction?.user.id ?? message?.author.id} for command ${command.command.name}: ${error}`;
    }

    stopMiddlewares(); // Stop the command from executing
  }

  const userPermissions =
    interaction?.memberPermissions ?? message?.member?.permissions;
  let missingUserPermissions: string[] = [];

  const botPermissions =
    interaction?.guild?.members.me?.permissions ??
    message?.guild?.members.me?.permissions;
  let missingBotPermissions: string[] = [];

  if (userPermissionsRequired.length) {
    for (const permission of userPermissionsRequired) {
      const hasPermission = userPermissions?.has(permission);
      if (!hasPermission) {
        missingUserPermissions.push(permission);
      }
    }
  }

  if (botPermissionsRequired.length) {
    for (const permission of botPermissionsRequired) {
      const hasPermission = botPermissions?.has(permission);
      if (!hasPermission) {
        missingBotPermissions.push(permission);
      }
    }
  }

  if (!missingUserPermissions.length && !missingBotPermissions.length) {
    return;
  }

  // Fix permission string. e.g. KickMembers -> Kick Members
  const pattern = /([a-z])([A-Z])|([A-Z]+)([A-Z][a-z])/g;

  missingUserPermissions = missingUserPermissions.map((str) =>
    str.replace(pattern, '$1$3 $2$4'),
  );
  missingBotPermissions = missingBotPermissions.map((str) =>
    str.replace(pattern, '$1$3 $2$4'),
  );

  let embedDescription = '';

  // @ts-ignore
  const formatter = new Intl.ListFormat('en', {
    style: 'long',
    type: 'conjunction',
  });

  const getPermissionWord = (permissions: string[]) =>
    permissions.length === 1 ? 'permission' : 'permissions';

  if (missingUserPermissions.length) {
    const formattedPermissions = missingUserPermissions.map((p) => `\`${p}\``);
    const permissionsString = formatter.format(formattedPermissions);

    embedDescription += `- You must have the ${permissionsString} ${getPermissionWord(
      missingUserPermissions,
    )} to be able to run this command.\n`;
  }

  if (missingBotPermissions.length) {
    const formattedPermissions = missingBotPermissions.map((p) => `\`${p}\``);
    const permissionsString = formatter.format(formattedPermissions);

    embedDescription += `- I must have the ${permissionsString} ${getPermissionWord(
      missingBotPermissions,
    )} to be able to execute this command.\n`;
  }

  const embed = new EmbedBuilder()
    .setTitle(`:x: Missing permissions!`)
    .setDescription(embedDescription)
    .setColor('Red');

  try {
    if (interaction && interaction.isRepliable()) {
      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    } else if (message && message.channel?.isSendable()) {
      await message.reply({
        embeds: [embed],
      });
    }
  } catch (error) {
    Logger.error`Could not send 'Not enough permissions' reply to user ${interaction?.user.id ?? message?.author.id} for command ${command.command.name}: ${error}`;
  }

  stopMiddlewares(); // Stop the command from executing
}
