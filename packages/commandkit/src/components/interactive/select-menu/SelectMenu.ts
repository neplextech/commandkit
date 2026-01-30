import {
  APISelectMenuOption,
  BaseSelectMenuComponentData,
  ChannelSelectMenuComponentData,
  ChannelSelectMenuInteraction,
  MentionableSelectMenuComponentData,
  MentionableSelectMenuInteraction,
  RoleSelectMenuComponentData,
  RoleSelectMenuInteraction,
  SelectMenuComponentOptionData,
  Snowflake,
  StringSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
  UserSelectMenuComponentData,
  UserSelectMenuInteraction,
} from 'discord.js';
import { ChannelSelectMenuKit } from './ChannelSelectMenuKit';
import { MentionableSelectMenuKit } from './MentionableSelectMenuKit';
import { RoleSelectMenuKit } from './RoleSelectMenuKit';
import { StringSelectMenuKit } from './StringSelectMenuKit';
import { UserSelectMenuKit } from './UserSelectMenuKit';
import { MaybeArray } from '../../common/types';
import {
  CommandKitSelectMenuBuilderInteractionCollectorDispatch,
  CommandKitSelectMenuBuilderInteractionCollectorDispatchContextData,
  CommandKitSelectMenuBuilderOnEnd,
} from './common';
import { applyDefaultOptionalComponentBehavior } from '../../common/element';

/**
 * Type for the common properties shared by all select menu builders.
 */
export interface CommonSelectMenuProps<T, C> {
  onSelect?: CommandKitSelectMenuBuilderInteractionCollectorDispatch<T, C>;
  onEnd?: CommandKitSelectMenuBuilderOnEnd;
  onError?: (error: Error) => any;
  options?: CommandKitSelectMenuBuilderInteractionCollectorDispatchContextData;
}

/**
 * Type for the base select menu component data.
 */
export interface SelectMenuProps<T, C>
  extends Partial<Omit<BaseSelectMenuComponentData, 'type' | 'required'>>,
    CommonSelectMenuProps<T, C> {
  required?: boolean;
}

/**
 * The properties for a string select menu component.
 */
export interface StringSelectMenuProps
  extends SelectMenuProps<StringSelectMenuInteraction, StringSelectMenuKit> {
  children?: MaybeArray<StringSelectMenuOptionBuilder>;
}

/**
 * Type for the common builder kit that can be used with select menus.
 */
export type CommonBuilderKit =
  | StringSelectMenuKit
  | UserSelectMenuKit
  | RoleSelectMenuKit
  | ChannelSelectMenuKit
  | MentionableSelectMenuKit;

/**
 * Type that resolves to the specific interaction type based on the builder type.
 * This is used to ensure that the interaction type matches the builder type.
 * For example, if the builder is a StringSelectMenuKit, the interaction type will be StringSelectMenuInteraction.
 * If the builder is a UserSelectMenuKit, the interaction type will be UserSelectMenuInteraction, and so on.
 */
export type ResolveBuilderInteraction<T> = T extends StringSelectMenuKit
  ? StringSelectMenuInteraction
  : T extends UserSelectMenuKit
    ? UserSelectMenuInteraction
    : T extends RoleSelectMenuKit
      ? RoleSelectMenuInteraction
      : T extends ChannelSelectMenuKit
        ? ChannelSelectMenuInteraction
        : T extends MentionableSelectMenuKit
          ? MentionableSelectMenuInteraction
          : never;

/**
 * @private
 */
function applyPropsToBuilder<B extends CommonBuilderKit>(
  builder: B,
  props: Partial<Omit<BaseSelectMenuComponentData, 'type' | 'required'>> &
    CommonSelectMenuProps<ResolveBuilderInteraction<B>, B> & {
      required?: boolean;
    },
) {
  applyDefaultOptionalComponentBehavior(props);

  builder.setCustomId(props.customId ?? `select-menu::${crypto.randomUUID()}`);

  if (props.maxValues != null) {
    builder.setMaxValues(props.maxValues);
  }

  if (props.minValues != null) {
    builder.setMinValues(props.minValues);
  }

  if (props.placeholder) {
    builder.setPlaceholder(props.placeholder);
  }

  if (props.disabled) {
    builder.setDisabled(props.disabled);
  }

  if (props.onEnd) {
    builder.onEnd(props.onEnd);
  }

  if (props.onError) {
    builder.onError(props.onError);
  }

  if (props.onSelect) {
    // @ts-ignore
    builder.onSelect(props.onSelect, props.options);
  }

  if (props.required != null) {
    builder.setRequired(props.required);
  }
}

/**
 * The StringSelectMenu component.
 * @param props The properties for the string select menu component.
 * @returns The string select menu builder instance.
 * @example ```tsx
 * import { StringSelectMenu } from 'commandkit';
 *
 * const stringSelectMenu = <StringSelectMenu
 *   customId="my-select-menu"
 *   placeholder="Select an option"
 *   maxValues={1}
 *   minValues={1}
 * >
 *   <StringSelectMenuOption label="Option 1" value="option1" />
 *   <StringSelectMenuOption label="Option 2" value="option2" />
 * </StringSelectMenu>
 * ```
 */
export function StringSelectMenu(props: StringSelectMenuProps) {
  const builder = new StringSelectMenuKit();

  applyPropsToBuilder(builder, props);

  if (props.children) {
    builder.setOptions(
      Array.isArray(props.children) ? props.children : [props.children],
    );
  }

  if (props.children) {
    builder.setOptions(
      Array.isArray(props.children) ? props.children : [props.children],
    );
  }

  return builder;
}

/**
 * Represents the properties for a string select menu option.
 * This can be either a SelectMenuComponentOptionData or an APISelectMenuOption.
 */
export type StringSelectMenuOptionProps =
  | SelectMenuComponentOptionData
  | APISelectMenuOption;

/**
 * A select menu option for the string select menu.
 * @param props The properties for the string select menu option.
 * @returns The string select menu option builder instance.
 * @example ```tsx
 * import { StringSelectMenuOption } from 'commandkit';
 *
 * const option = <StringSelectMenuOption label="Option 1" value="option1" />;
 * ```
 */
export function StringSelectMenuOption(props: StringSelectMenuOptionProps) {
  return new StringSelectMenuOptionBuilder(props);
}

/**
 * The UserSelectMenu component.
 */
export interface UserSelectMenuProps
  extends Partial<Omit<UserSelectMenuComponentData, 'type' | 'defaultValues'>>,
    CommonSelectMenuProps<UserSelectMenuInteraction, UserSelectMenuKit> {
  defaultValues?: MaybeArray<string | Snowflake>;
}

/**
 * The UserSelectMenu component.
 * @param props The properties for the user select menu component.
 * @returns The user select menu builder instance.
 * @example ```tsx
 * import { UserSelectMenu } from 'commandkit';
 *
 * const userSelectMenu = <UserSelectMenu />
 * ```
 */
export function UserSelectMenu(props: UserSelectMenuProps) {
  const builder = new UserSelectMenuKit();

  applyPropsToBuilder(builder, props);

  if (props.defaultValues) {
    builder.setDefaultUsers(
      Array.isArray(props.defaultValues)
        ? props.defaultValues
        : [props.defaultValues],
    );
  }

  return builder;
}

/**
 * The RoleSelectMenu component props.
 */
export interface RoleSelectMenuProps
  extends Partial<Omit<RoleSelectMenuComponentData, 'type'>>,
    CommonSelectMenuProps<RoleSelectMenuInteraction, RoleSelectMenuKit> {}

/**
 * The RoleSelectMenu component.
 * @param props The properties for the role select menu component.
 * @returns The role select menu builder instance.
 * @example ```tsx
 * import { RoleSelectMenu } from 'commandkit';
 *
 * const roleSelectMenu = <RoleSelectMenu />
 * ```
 */
export function RoleSelectMenu(props: RoleSelectMenuProps) {
  const builder = new RoleSelectMenuKit();

  applyPropsToBuilder(builder, props);

  if (props.defaultValues) {
    builder.setDefaultRoles(
      Array.isArray(props.defaultValues)
        ? props.defaultValues
        : [props.defaultValues],
    );
  }

  return builder;
}

/**
 * The MentionableSelectMenu component props.
 */
export interface MentionableSelectMenuProps
  extends Partial<Omit<MentionableSelectMenuComponentData, 'type'>>,
    CommonSelectMenuProps<
      MentionableSelectMenuInteraction,
      MentionableSelectMenuKit
    > {}

/**
 * The MentionableSelectMenu component.
 * @param props The properties for the mentionable select menu component.
 * @returns The mentionable select menu builder instance.
 * @example ```tsx
 * import { MentionableSelectMenu } from 'commandkit';
 * const mentionableSelectMenu = <MentionableSelectMenu />
 * ```
 */
export function MentionableSelectMenu(props: MentionableSelectMenuProps) {
  const builder = new MentionableSelectMenuKit();

  applyPropsToBuilder(builder, props);

  if (props.defaultValues) {
    builder.setDefaultValues(
      Array.isArray(props.defaultValues)
        ? props.defaultValues
        : [props.defaultValues],
    );
  }

  return builder;
}

/**
 * The ChannelSelectMenu component props.
 */
export interface ChannelSelectMenuProps
  extends Partial<Omit<ChannelSelectMenuComponentData, 'type'>>,
    CommonSelectMenuProps<ChannelSelectMenuInteraction, ChannelSelectMenuKit> {}

/**
 * The ChannelSelectMenu component.
 * @param props The properties for the channel select menu component.
 * @returns The channel select menu builder instance.
 * @example ```tsx
 * import { ChannelSelectMenu } from 'commandkit';
 * const channelSelectMenu = <ChannelSelectMenu />
 * ```
 */
export function ChannelSelectMenu(props: ChannelSelectMenuProps) {
  const builder = new ChannelSelectMenuKit();

  applyPropsToBuilder(builder, props);

  if (props.defaultValues) {
    builder.setDefaultChannels(
      Array.isArray(props.defaultValues)
        ? props.defaultValues
        : [props.defaultValues],
    );
  }

  if (props.channelTypes) {
    builder.setChannelTypes(
      Array.isArray(props.channelTypes)
        ? props.channelTypes
        : [props.channelTypes],
    );
  }

  return builder;
}
