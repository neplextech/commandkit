import type { ActionRowBuilder, TextInputBuilder } from 'discord.js';
import type { ButtonKit } from '../interactive/button/ButtonKit';
import type { ModalKit } from '../interactive/modal/ModalKit';
import { getConfig } from '../../config/config';

/**
 * Represents the types of elements that can be used in CommandKit.
 */
export const ElementType = {
  ActionRow: 'action-row',
  Button: 'button-kit',
  Modal: 'modal',
  TextInput: 'text-input',
} as const;

/**
 * The type of element that can be used in CommandKit.
 * This is a union of the keys of the ElementType object.
 */
export type ElementType = (typeof ElementType)[keyof typeof ElementType];

/**
 * The data structure that maps each ElementType to its corresponding CommandKit element.
 */
export interface CommandKitElementData {
  [ElementType.ActionRow]: ActionRowBuilder;
  [ElementType.Button]: ButtonKit;
  [ElementType.Modal]: ModalKit;
  [ElementType.TextInput]: TextInputBuilder;
}

/**
 * Represents a CommandKit element with a specific type and data.
 */
export type CommandKitElement<Type extends ElementType> =
  CommandKitElementData[Type];

/**
 * Represents any CommandKit element, which can be of any type defined in CommandKitElementData.
 */
export type AnyCommandKitElement = CommandKitElement<ElementType>;

/**
 * Checks if the given element is a CommandKit element.
 * @param element The element to check.
 * @returns True if the element is a CommandKit element, false otherwise.
 */
export function isCommandKitElement(
  element: unknown,
): element is CommandKitElement<ElementType> {
  if (typeof element !== 'object' || element === null) return false;
  if (!Reflect.has(element, 'type')) return false;
  if (!Reflect.has(element, 'data')) return false;

  return true;
}

/**
 * Gets the element data for a specific CommandKit element.
 * @param element The CommandKit element to get the data for.
 * @returns The element data for the specified CommandKit element.
 */
export function getElement<
  T extends ElementType,
  E extends CommandKitElement<T>,
>(element: E): CommandKitElementData[T] {
  return element.data as CommandKitElementData[T];
}

/**
 * Represents the properties for a fragment element in CommandKit.
 */
export interface FragmentElementProps {
  children: [];
}

/**
 * Represents a fragment of CommandKit elements.
 * @param props The properties for the fragment.
 * @returns The fragment element.
 */
export function Fragment(
  props: FragmentElementProps,
): CommandKitElementData[ElementType][] {
  return Array.isArray(props.children)
    ? props.children.flat()
    : [props.children];
}

/**
 * The createElement function is used to create CommandKit elements.
 * @param type The type of the element to create.
 * @param props The properties for the element.
 * @param children The children of the element.
 * @returns The created CommandKit element.
 */
export function createElement(
  type: Function,
  props: Record<string, unknown>,
  ...children: any[]
): CommandKitElement<ElementType> {
  return type({ ...props, children: props.children ?? children });
}

export { createElement as jsx, createElement as jsxs };

let _isOptional: boolean;

export function applyDefaultOptionalComponentBehavior<P>(props: P): P {
  if (
    props &&
    typeof props === 'object' &&
    (props as { required?: boolean }).required == null &&
    (_isOptional ??= getConfig().jsxDefaultOptionalComponents)
  ) {
    (props as { required?: boolean }).required ??= false;
  }

  return props;
}
