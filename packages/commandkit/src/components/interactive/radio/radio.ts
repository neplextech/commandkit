import {
  RadioGroupBuilder,
  RadioGroupComponentData,
  RadioGroupOptionBuilder,
} from 'discord.js';
import { MaybeArray } from '../../common/types';
import { applyId } from '../../display/common';

export interface RadioGroupProps extends Omit<
  RadioGroupComponentData,
  'type' | 'options'
> {
  id?: number;
  customId: string;
  children?: MaybeArray<RadioGroupOptionBuilder>;
  required?: boolean;
}

export function RadioGroup(props: RadioGroupProps) {
  const radioGroup = new RadioGroupBuilder();

  applyId(props, radioGroup);

  radioGroup.setCustomId(props.customId);

  if (props.children != null) {
    const options = (
      Array.isArray(props.children) ? props.children : [props.children]
    ).filter((option): option is RadioGroupOptionBuilder => option != null);

    if (options.length === 0) {
      throw new Error(
        'RadioGroup requires at least 1 option. Use <RadioGroupOption label=... value=... /> as a child.',
      );
    }

    radioGroup.setOptions(options);
  }

  if (props.required != null) {
    radioGroup.setRequired(props.required);
  }

  return radioGroup;
}

export interface RadioGroupOptionProps {
  label: string;
  value: string;
  description?: string;
  default?: boolean;
}

export function RadioGroupOption(props: RadioGroupOptionProps) {
  const option = new RadioGroupOptionBuilder();

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
