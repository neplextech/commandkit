import {
  CheckboxComponentData,
  CheckboxBuilder,
  CheckboxGroupOptionBuilder,
  CheckboxGroupComponentData,
  CheckboxGroupBuilder,
} from 'discord.js';
import { MaybeArray } from '../../common/types';
import { applyId } from '../../display/common';

export interface CheckboxProps extends Omit<
  CheckboxComponentData,
  'type' | 'required'
> {
  id?: number;
  default?: boolean;
}

export function Checkbox(props: CheckboxProps) {
  const checkbox = new CheckboxBuilder();

  applyId(props, checkbox);

  if (props.customId != null) {
    checkbox.setCustomId(props.customId);
  }

  if (props.default != null) {
    checkbox.setDefault(props.default);
  }

  return checkbox;
}

export interface CheckboxGroupOptionProps {
  label: string;
  value: string;
  description?: string;
  default?: boolean;
}

export function CheckboxGroupOption(props: CheckboxGroupOptionProps) {
  const option = new CheckboxGroupOptionBuilder();

  option.setLabel(props.label);
  option.setValue(props.value);

  if (props.description != null) {
    option.setDescription(props.description);
  }

  if (props.default != null) {
    option.setDefault(props.default);
  }

  return option;
}

export interface CheckboxGroupProps extends Omit<
  CheckboxGroupComponentData,
  'type' | 'options'
> {
  id?: number;
  customId: string;
  children?: MaybeArray<CheckboxGroupOptionBuilder>;
  minValues?: number;
  maxValues?: number;
  required?: boolean;
}

export function CheckboxGroup(props: CheckboxGroupProps) {
  const checkboxGroup = new CheckboxGroupBuilder();

  applyId(props, checkboxGroup);

  if (props.customId != null) {
    checkboxGroup.setCustomId(props.customId);
  }

  if (props.required != null) {
    checkboxGroup.setRequired(props.required);
  }

  if (props.minValues != null) {
    checkboxGroup.setMinValues(props.minValues);
  }

  if (props.maxValues != null) {
    checkboxGroup.setMaxValues(props.maxValues);
  }

  if (props.children != null) {
    const options = (
      Array.isArray(props.children) ? props.children : [props.children]
    ).filter((option): option is CheckboxGroupOptionBuilder => option != null);

    if (options.length === 0) {
      throw new Error(
        'CheckboxGroup requires at least 1 option. Use <CheckboxGroupOption label=... value=... /> as a child.',
      );
    }

    checkboxGroup.setOptions(options);
  }

  return checkboxGroup;
}
