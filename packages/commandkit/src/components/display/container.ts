import {
  ActionRowBuilder,
  ColorResolvable,
  ComponentBuilder,
  ContainerBuilder,
  ContainerComponentData,
  FileBuilder,
  MediaGalleryBuilder,
  resolveColor,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { applyId } from './common';

/**
 * Represents the properties for a container component.
 */
export interface ContainerProps extends Omit<
  ContainerComponentData,
  'type' | 'components' | 'accentColor'
> {
  accentColor?: ColorResolvable;
  children?: ComponentBuilder[];
}

/**
 * The components v2 container component
 * @param props - The properties for the container component.
 * @returns the container builder instance.
 * @example ```tsx
 * import { Container } from 'commandkit';
 *
 * const container = <Container>...</Container>;
 * ```
 */
export function Container(props: ContainerProps): ContainerBuilder {
  const container = new ContainerBuilder();

  applyId(props, container);

  if (props.accentColor != null) {
    container.setAccentColor(resolveColor(props.accentColor));
  }

  if (props.spoiler != null) {
    container.setSpoiler(props.spoiler);
  }

  if (props.children != null) {
    if (!Array.isArray(props.children)) props.children = [props.children];
    if (props.children.length === 0) return container;

    for (const child of props.children.flat()) {
      if (child instanceof TextDisplayBuilder) {
        container.addTextDisplayComponents(child);
      }

      if (child instanceof FileBuilder) {
        container.addFileComponents(child);
      }

      if (child instanceof ActionRowBuilder) {
        container.addActionRowComponents(child);
      }

      if (child instanceof SeparatorBuilder) {
        container.addSeparatorComponents(child);
      }

      if (child instanceof SectionBuilder) {
        container.addSectionComponents(child);
      }

      if (child instanceof MediaGalleryBuilder) {
        container.addMediaGalleryComponents(child);
      }
    }
  }

  return container;
}
