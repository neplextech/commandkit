# 04 jsx components

## Purpose

Provide valid JSX component patterns for interactive and display use
cases without invalid handler assumptions.

## When to use

Use when building Discord UI with JSX components, especially
interactive flows with buttons/selects/modals.

## Filesystem

```txt
project/
  commandkit.config.ts
  src/
    app/
      commands/
      events/
```

## Example

```tsx
import {
  ActionRow,
  Button,
  OnButtonKitClick,
  ChatInputCommand,
  CommandData,
} from 'commandkit';
import { ButtonStyle, MessageFlags } from 'discord.js';

export const command: CommandData = {
  name: 'confirmation',
  description: 'Confirm an action with buttons',
};

const handleConfirm: OnButtonKitClick = async (interaction, context) => {
  await interaction.reply({
    content: 'Confirmed.',
    flags: MessageFlags.Ephemeral,
  });
  context.dispose(); // clean up the listener
};

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  const row = (
    <ActionRow>
      {/* commandkit auto assigns customId for JSX components by default */}
      <Button onClick={handleConfirm} style={ButtonStyle.Success}>
        Confirm
      </Button>
    </ActionRow>
  );

  await interaction.reply({
    content: 'Proceed?',
    components: [row],
  });
};
```

```tsx
import { ActionRow, Button } from 'commandkit';
import { ButtonStyle } from 'discord.js';

const row = (
  <ActionRow>
    <Button url="https://commandkit.dev" style={ButtonStyle.Link}>
      Website
    </Button>
  </ActionRow>
);
```

```tsx
import { Container, TextDisplay, ChatInputCommand } from 'commandkit';
import { Colors, MessageFlags } from 'discord.js';

export const chatInput: ChatInputCommand = async (ctx) => {
  const container = (
    <Container accentColor={Colors.Fuchsia}>
      <TextDisplay content="# Components v2 test" />
    </Container>
  );

  await ctx.interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
};
```

## Important details

- Use exact API/export names shown in the example.
- Keep filesystem placement aligned with enabled plugins and feature
  expectations.
- Preserve deterministic behavior and explicit error handling in
  implementation code.

## Best practices

- Keep snippets as baseline patterns and adapt them to real command
  names and data models.
- Validate external inputs and permission boundaries before side
  effects.
- Keep setup deterministic so startup behavior is stable across
  environments.

## Common mistakes

- Using non-link buttons without onClick handlers.
- Forgetting MessageFlags.IsComponentsV2 when sending v2 container
  payloads.
- Mixing interactive and link button patterns incorrectly.
