import { ComponentBuilder } from 'discord.js';
import { applyDefaultOptionalComponentBehavior } from '../..';

/**
 * @private
 */
export function applyId(props: { id?: number }, component: ComponentBuilder) {
  applyDefaultOptionalComponentBehavior(props);

  if (props.id != null && 'setId' in component) {
    component.setId(props.id);
  }
}
