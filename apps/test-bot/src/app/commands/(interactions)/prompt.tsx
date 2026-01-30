import {
  CommandData,
  Modal,
  ShortInput,
  ParagraphInput,
  Label,
  OnModalKitSubmit,
  MessageCommandContext,
  ChatInputCommandContext,
  StringSelectMenu,
  StringSelectMenuOption,
  FileUpload,
} from 'commandkit';
import { MessageFlags } from 'discord.js';

export const command: CommandData = {
  name: 'prompt',
  description: 'This is a prompt command.',
};

const handleSubmit: OnModalKitSubmit = async (interaction, context) => {
  const name = interaction.fields.getTextInputValue('name');
  const description = interaction.fields.getTextInputValue('description');
  const select = interaction.fields.getField('select');

  await interaction.reply({
    content: `Name: ${name}\nDescription: ${description}\nSelect: ${select}`,
    flags: MessageFlags.Ephemeral,
  });

  context.dispose();
};

export async function chatInput(ctx: ChatInputCommandContext) {
  const modal = (
    <Modal title="Modal" onSubmit={handleSubmit}>
      <Label label="Name" description="Enter your name">
        <ShortInput customId="name" placeholder="John Doe" required />
      </Label>
      <Label label="Description" description="Enter a description here...">
        <ParagraphInput
          customId="description"
          placeholder="Lorem ipsum dolor sit amet..."
        />
      </Label>
      <Label label="File" description="Upload a file">
        <FileUpload customId="file" />
      </Label>
      <Label label="Select" description="Select an option">
        <StringSelectMenu customId="select">
          <StringSelectMenuOption
            label="Option 1"
            value="option1"
            description="This is the first option"
            emoji="👍"
          />
          <StringSelectMenuOption
            label="Option 2"
            value="option2"
            description="This is the second option"
            emoji="👍"
          />
          <StringSelectMenuOption
            label="Option 3"
            value="option3"
            description="This is the third option"
            emoji="👍"
          />
        </StringSelectMenu>
      </Label>
    </Modal>
  );

  await ctx.interaction.showModal(modal);
}

export async function message(ctx: MessageCommandContext) {
  ctx.message.reply('Prompt is only available in slash commands.');
}
