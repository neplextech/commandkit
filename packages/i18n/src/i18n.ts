import i18next from 'i18next';
import type {
  NewableModule,
  Module,
  Newable,
  i18n,
  InitOptions,
} from 'i18next';
import CommandKit, {
  CommandKitPluginRuntime,
  Context as NativeContext,
  Logger,
  RuntimePlugin,
  getCurrentDirectory,
  useEnvironment,
  CommandKitEnvironment,
  CommandSource,
  PreparedAppCommandExecution,
  CommandBuilderLike,
  CommandKitHMREvent,
  getCommandKit,
  COMMANDKIT_CWD,
  PreRegisterCommandsEvent,
} from 'commandkit';
import FsBackend from 'i18next-fs-backend';
import { basename, extname, join } from 'path';
import { FsBackendOptions } from 'i18next-fs-backend';
import { ApplicationCommandType, Locale } from 'discord.js';
import { existsSync } from 'fs';
import {
  BasicCommandTranslationMetadata,
  CommandTranslation,
  CommandTranslationMetadata,
} from './types';
import {
  COMMAND_METADATA_KEY,
  DISCORD_LOCALES,
  MESSAGE_CTX_COMMAND_METADATA_KEY,
  USER_CTX_COMMAND_METADATA_KEY,
} from './constants';
import { applyTranslations } from './utils';
import { readdir, readFile } from 'fs/promises';

/**
 * @private
 */
export type Awaitable<T> = Promise<T> | T;

/**
 * Represents a localization module that can be used with the i18next plugin.
 */
export type LocalizationModule =
  NewableModule<Module> | Module | Newable<Module>;

/**
 * Represents a dynamic localization module that can be used with the i18next plugin.
 */
export type DynamicLocalizationModule = () => Awaitable<LocalizationModule>;

/**
 * Options for the localization plugin.
 * This interface defines the options that can be passed to the localization plugin.
 * It includes the i18next plugins to use and the i18next initialization options.
 */
export interface LocalizationPluginOptions {
  /**
   * The i18next plugins to use. The plugins are loaded in the order they are
   * specified.
   */
  plugins?: Array<LocalizationModule | DynamicLocalizationModule>;
  /**
   * The i18next initialization options.
   * @see https://www.i18next.com/overview/configuration-options
   */
  i18nOptions?: InitOptions;
}

export interface CommandLocalizationContext {
  /**
   * The i18next instance.
   */
  i18n: i18n;
  /**
   * The localization function bound to the current command.
   * @param key The key to translate.
   * @param options The options to pass to the translation function.
   */
  t: (key: string, options?: Record<string, unknown>) => string;
  /**
   * The locale to use for the command.
   */
  locale: Locale;
  /**
   * Whether the localization context is from event worker context.
   */
  isEventWorker?: boolean;
}

declare module 'commandkit' {
  /**
   * Represents the localization context for a command.
   */
  export interface LocalizationContext extends CommandLocalizationContext {}

  interface Context {
    /**
     * Returns the localization context for the current command.
     * @param locale The locale to use. Defaults to the detected locale or the default locale.
     */
    locale: (locale?: Locale) => LocalizationContext;
  }
}

NativeContext.prototype.locale = function (locale?: Locale) {
  const env = this.config.environment || useEnvironment();
  const detectedLocale: Locale = locale || this.getLocale();
  const i18n = env.variables.get('i18n:plugin:instance') as i18n;

  if (!i18n) {
    throw new Error('I18n plugin not found in context environment variables');
  }

  return {
    t: i18n.getFixedT(detectedLocale, this.getCommandIdentifier()),
    locale: detectedLocale,
    i18n,
  } satisfies CommandLocalizationContext;
};

/**
 * Retrieves the i18n instance from the commandkit store.
 * @param commandkit The commandkit instance.
 * @returns The i18n instance.
 * @throws Error if the i18n instance is not found in the store.
 * @example
 * ```ts
 * import { useI18n } from '@commandkit/i18n';
 * import { commandkit } from 'commandkit';
 *
 * const i18n = useI18n(commandkit);
 *
 * // Use the i18n instance
 * i18n.t('key');
 * ```
 */
export function useI18n(commandkit?: CommandKit): i18n {
  commandkit ??= getCommandKit(true);

  const i18n = commandkit.store.get('i18n:plugin:instance') as i18n;

  if (!i18n) {
    throw new Error('I18n not found, is the I18nPlugin registered?');
  }

  return i18n;
}

export class I18nPlugin extends RuntimePlugin<LocalizationPluginOptions> {
  public readonly name = 'I18nPlugin';
  private i18n!: i18n;
  private metadata = new Map<string, CommandTranslationMetadata>();

  public async activate(ctx: CommandKitPluginRuntime): Promise<void> {
    this.i18n = i18next;

    ctx.commandkit.store.set('i18n:plugin:instance', this.i18n);

    this.i18n.use(FsBackend);

    if (this.options.plugins?.length) {
      for (const plugin of this.options.plugins) {
        if (typeof plugin === 'function') {
          const module = await (plugin as DynamicLocalizationModule)();
          this.i18n.use(module);
        } else {
          this.i18n.use(plugin);
        }
      }
    }

    // Setup better debugging
    const debug = this.options.i18nOptions?.debug || false;

    const { namespaces, languages } = await this.scanLocaleDirectory();

    await this.i18n.init({
      initAsync: false,
      fallbackLng: 'en-US',
      debug,
      ns: namespaces,
      preload: languages,
      load: 'all',
      interpolation: {
        escapeValue: false,
        skipOnVariables: false,
      },
      ...this.options.i18nOptions,
      backend: this.getBackendOptions(),
    });

    // Check if we have any languages available
    if (this.i18n.languages.length === 0) {
      Logger.warn(
        'I18nPlugin: No languages loaded. Using default language only.',
      );
    }

    // Set the default locale for command execution
    ctx.commandkit.appConfig.defaultLocale = (this.i18n.language ||
      'en-US') as Locale;

    Logger.info('I18nPlugin has been activated');
  }

  public static getLoadPath(
    cwd = getCurrentDirectory(),
    lng = '{{lng}}',
    ns = '{{ns}}',
  ) {
    return join(cwd, `/app/locales/${lng}/${ns}.json`);
  }

  private async scanLocaleDirectory() {
    const endPattern = /{{lng}}(\/|\\){{ns}}.json$/;
    const eventFilePattern = /\.event\.json$/;
    const localesPath = I18nPlugin.getLoadPath();
    const scanDirTarget = localesPath.replace(endPattern, '');

    if (!existsSync(scanDirTarget)) {
      Logger.warn(
        `I18nPlugin: No locales directory found at ${scanDirTarget}. Skipping scan.`,
      );

      return { namespaces: [], languages: [] };
    }

    const namespaces = new Set<string>();
    const languages = new Set<string>();

    const files = await readdir(scanDirTarget, { withFileTypes: true });

    for (const file of files) {
      const isValidLocale = DISCORD_LOCALES.has(file.name as Locale);

      if (file.isDirectory()) {
        if (!isValidLocale) {
          Logger.warn(`I18nPlugin: Invalid locale directory ${file.name}`);
          continue;
        }

        languages.add(file.name);

        const files = await readdir(join(scanDirTarget, file.name), {
          withFileTypes: true,
        });

        for (const file of files) {
          if (file.isFile()) {
            const ext = extname(file.name);

            if (!/\.json$/.test(ext)) continue;

            const isEvent = eventFilePattern.test(file.name);

            const name = basename(file.name, ext);
            namespaces.add(name);

            const locale = basename(file.parentPath);

            if (!isEvent)
              await this.loadMetadata(
                join(file.parentPath, file.name),
                locale,
                name,
              );
          }
        }
      } else if (file.isFile()) {
        const ext = extname(file.name);

        if (!/\.json$/.test(ext)) continue;

        const isEvent = eventFilePattern.test(file.name);
        const name = basename(file.name, ext);
        namespaces.add(name);

        const locale = basename(file.parentPath);

        if (!isEvent) {
          await this.loadMetadata(
            join(file.parentPath, file.name),
            locale,
            name,
          );
        }
      }
    }

    return {
      namespaces: Array.from(namespaces),
      languages: Array.from(languages),
    };
  }

  public async performHMR(
    ctx: CommandKitPluginRuntime,
    event: CommandKitHMREvent,
  ): Promise<void> {
    const targetLocation = event.path;
    const localeDir = join(COMMANDKIT_CWD, '/src/app/locales');

    if (!targetLocation.startsWith(localeDir)) return;

    event.accept();
    event.preventDefault();

    const { languages, namespaces } = await this.scanLocaleDirectory();

    await this.i18n.reloadResources(languages, namespaces);

    await ctx.commandkit.reloadCommands();
  }

  private async loadMetadata(
    filePath: string,
    locale: string,
    name: string,
  ): Promise<void> {
    try {
      const translationResource = JSON.parse(
        await readFile(filePath, {
          encoding: 'utf8',
        }),
      );
      const translation: CommandTranslation =
        translationResource.default || translationResource;

      if (!translation) return;

      const metadata = translation[COMMAND_METADATA_KEY];
      const userCtxMetadata = translation[USER_CTX_COMMAND_METADATA_KEY];
      const messageCtxMetadata = translation[MESSAGE_CTX_COMMAND_METADATA_KEY];

      if (metadata) {
        this.metadata.set(`${locale}:${name}`, metadata);
      }

      if (userCtxMetadata) {
        this.metadata.set(`${locale}:${name}:user-ctx`, userCtxMetadata);
      }

      if (messageCtxMetadata) {
        this.metadata.set(`${locale}:${name}:message-ctx`, messageCtxMetadata);
      }
    } catch {}
  }

  private getBackendOptions() {
    const loadPath = I18nPlugin.getLoadPath();

    return {
      loadPath: function (lng: string, namespace: string) {
        const path = loadPath
          .replace(/{{lng}}/g, lng)
          .replace(/{{ns}}/g, namespace);

        return path;
      },
    } satisfies FsBackendOptions;
  }

  public async executeCommand(
    ctx: CommandKitPluginRuntime,
    env: CommandKitEnvironment,
    source: CommandSource,
    command: PreparedAppCommandExecution,
  ): Promise<boolean> {
    env.variables.set('i18n:plugin:instance', this.i18n);

    return false;
  }

  public async prepareCommand(
    ctx: CommandKitPluginRuntime,
    command: CommandBuilderLike,
  ): Promise<CommandBuilderLike | null> {
    const data = 'toJSON' in command ? command.toJSON() : command;

    for (const locale of DISCORD_LOCALES) {
      try {
        const translation = this.metadata.get(`${locale}:${data.name}`);

        if (!translation) continue;

        applyTranslations(data, locale, translation);
      } catch (e) {
        console.log(e);
        continue;
      }
    }

    return data;
  }

  public async onBeforeRegisterCommands(
    ctx: CommandKitPluginRuntime,
    event: PreRegisterCommandsEvent,
  ): Promise<void> {
    const { commands } = event;
    const validTypes = [
      ApplicationCommandType.User,
      ApplicationCommandType.Message,
    ];

    for (const command of commands) {
      if (!validTypes.includes(command.type!)) continue;

      for (const locale of DISCORD_LOCALES) {
        const translationBasic = (
          command.type === ApplicationCommandType.User
            ? this.metadata.get(`${locale}:${command.name}:user-ctx`)
            : this.metadata.get(`${locale}:${command.name}:message-ctx`)
        ) as BasicCommandTranslationMetadata;

        if (translationBasic?.name) {
          command.name_localizations ??= {};
          command.name_localizations[locale] = translationBasic.name;
        }

        // context menu commands don't have a description
        delete command.description;
        delete command.description_localizations;
      }
    }
  }
}
