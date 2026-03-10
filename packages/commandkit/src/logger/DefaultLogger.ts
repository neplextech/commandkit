import { getContext } from '../context/async-context';
import colors from '../utils/colors';
import { COMMANDKIT_IS_DEV } from '../utils/constants';
import { ILogger } from './ILogger';
import { Console } from 'node:console';
import { inspect } from 'util';

/**
 * Log levels for the logger.
 */
enum LogLevel {
  DEBUG,
  INFO,
  WARN,
  ERROR,
  DEFAULT,
}

const execHandlerKind = {
  autocomplete: 'Autocomplete',
  messageContextMenu: 'MessageContextMenu',
  userContextMenu: 'UserContextMenu',
  chatInput: 'ChatInputCommand',
  message: 'Message',
};

const TextColorMap = {
  [LogLevel.DEBUG]: colors.blue,
  [LogLevel.INFO]: colors.green,
  [LogLevel.WARN]: colors.yellow,
  [LogLevel.ERROR]: colors.red,
  [LogLevel.DEFAULT]: colors.white,
};

const TextBgColorMap = {
  [LogLevel.DEBUG]: colors.bgBlue,
  [LogLevel.INFO]: colors.bgGreen,
  [LogLevel.WARN]: colors.bgYellow,
  [LogLevel.ERROR]: colors.bgRed,
  [LogLevel.DEFAULT]: colors.bgWhite,
};

const BoxChars = {
  vertical: '│',
  horizontalDown: '┬',
  horizontalUp: '┴',
  verticalRight: '├',
  corner: '└',
};

/**
 * Default logger implementation that logs messages to the console.
 * It formats the log messages with timestamps, log levels, and context information.
 */
export class DefaultLogger implements ILogger {
  private logger: Console;

  /**
   * Creates a new instance of DefaultLogger.
   * @param stdout The output stream for standard messages (default: process.stdout).
   * @param stderr The output stream for error messages (default: process.stderr).
   */
  public constructor(
    public stdout = process.stdout,
    public stderr = process.stderr,
  ) {
    this.logger = new Console(this.stdout, this.stderr);
  }

  private _formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const millis = date.getMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${millis}`;
  }

  private _getContext(): string {
    const ctx = getContext();
    if (!ctx) return '';

    const kind = ctx.variables.get('execHandlerKind');
    const commandHandler = ctx.variables.get('commandHandlerType');
    const command = ctx.variables.get('currentCommandName');
    if (!kind && !commandHandler) return '';

    const h = execHandlerKind[kind as keyof typeof execHandlerKind];

    if (!h && !commandHandler) return '';

    const forwardedBy = ctx.variables.get('forwardedBy');
    const forwardedTo = ctx.variables.get('forwardedTo');

    const cmdText = command ? colors.magenta(`/${command}`) + ' ' : '';
    const forward = forwardedTo
      ? `${colors.yellowBright(`(${forwardedBy || command} → ${forwardedTo})`)} `
      : '';

    return (
      colors.dim(`${BoxChars.vertical} `) +
      colors.cyanBright(
        `${cmdText}${forward}${h ? colors.gray(`[${h}]`) : ''}`.trim(),
      )
    );
  }

  private _getLevelLabel(level: LogLevel): string {
    let label: string;
    switch (level) {
      case LogLevel.DEBUG:
        label = '[DEBUG]';
        break;
      case LogLevel.INFO:
        label = '[INFO]';
        break;
      case LogLevel.WARN:
        label = '[WARN]';
        break;
      case LogLevel.ERROR:
        label = '[ERROR]';
        break;
      default:
        label = '[LOG]';
    }

    const coloredLabel = TextBgColorMap[level](
      colors.whiteBright(` ${label} `),
    );
    return `${coloredLabel}   `;
  }

  private _getPrefix(level: LogLevel): string {
    const timestamp = this._formatTime(new Date());
    const label = this._getLevelLabel(level);
    return `${label}${colors.dim(BoxChars.vertical)} ${colors.dim(timestamp)}`;
  }

  private _log(level: LogLevel, message: any): void {
    const prefix = this._getPrefix(level);
    const context = this._getContext();
    const colorFn = TextColorMap[level];

    let processedMessage = message;
    if (message instanceof Error) {
      processedMessage = `${message.message}\n${message.stack}`;
    }

    if (context) {
      this.logger.log(
        `${prefix}\n${context} ${colors.dim(BoxChars.corner)}`,
        colorFn(processedMessage),
      );
    } else {
      this.logger.log(
        `${prefix} ${colors.dim(BoxChars.corner)}`,
        colorFn(processedMessage),
      );
    }
  }

  private _logTemplate(
    level: LogLevel,
    strings: TemplateStringsArray,
    ...values: any[]
  ): void {
    const prefix = this._getPrefix(level);
    const context = this._getContext();
    const colorFn = TextColorMap[level];

    let result = '';
    for (let i = 0; i < strings.length; i++) {
      result += strings[i];
      if (i < values.length) {
        const value = values[i];
        if (value instanceof Error) {
          result += `${value.message}\n${value.stack}`;
        } else if (value !== null && typeof value === 'object') {
          result += inspect(value, { colors: true, depth: 2 });
        } else {
          result += value;
        }
      }
    }

    if (context) {
      this.logger.log(
        `${prefix}\n${context} ${colors.dim(BoxChars.corner)}`,
        colorFn(result),
      );
    } else {
      this.logger.log(
        `${prefix} ${colors.dim(BoxChars.corner)}`,
        colorFn(result),
      );
    }
  }

  /**
   * Logs a debug message.
   * @param message The message to log.
   */
  public debug(message: any): void;
  public debug(strings: TemplateStringsArray, ...values: any[]): void;
  public debug(
    messageOrStrings: any | TemplateStringsArray,
    ...values: any[]
  ): void {
    if (this._isTemplateStringsArray(messageOrStrings)) {
      this._logTemplate(LogLevel.DEBUG, messageOrStrings, ...values);
    } else {
      this._log(LogLevel.DEBUG, messageOrStrings);
    }
  }

  /**
   * Logs an error message.
   * @param message The error message to log.
   */
  public error(message: any): void;
  public error(strings: TemplateStringsArray, ...values: any[]): void;
  public error(
    messageOrStrings: any | TemplateStringsArray,
    ...values: any[]
  ): void {
    if (this._isTemplateStringsArray(messageOrStrings)) {
      this._logTemplate(LogLevel.ERROR, messageOrStrings, ...values);
    } else {
      this._log(LogLevel.ERROR, messageOrStrings);
    }
  }

  /**
   * Logs a default message.
   * @param message The message to log.
   */
  public log(message: any): void;
  public log(strings: TemplateStringsArray, ...values: any[]): void;
  public log(
    messageOrStrings: any | TemplateStringsArray,
    ...values: any[]
  ): void {
    if (this._isTemplateStringsArray(messageOrStrings)) {
      this._logTemplate(LogLevel.DEFAULT, messageOrStrings, ...values);
    } else {
      this._log(LogLevel.DEFAULT, messageOrStrings);
    }
  }

  /**
   * Logs an info message.
   * @param message The informational message to log.
   */
  public info(message: any): void;
  public info(strings: TemplateStringsArray, ...values: any[]): void;
  public info(
    messageOrStrings: any | TemplateStringsArray,
    ...values: any[]
  ): void {
    if (this._isTemplateStringsArray(messageOrStrings)) {
      this._logTemplate(LogLevel.INFO, messageOrStrings, ...values);
    } else {
      this._log(LogLevel.INFO, messageOrStrings);
    }
  }

  /**
   * Logs a warning message.
   * @param message The warning message to log.
   */
  public warn(message: any): void;
  public warn(strings: TemplateStringsArray, ...values: any[]): void;
  public warn(
    messageOrStrings: any | TemplateStringsArray,
    ...values: any[]
  ): void {
    if (this._isTemplateStringsArray(messageOrStrings)) {
      this._logTemplate(LogLevel.WARN, messageOrStrings, ...values);
    } else {
      this._log(LogLevel.WARN, messageOrStrings);
    }
  }

  private _isTemplateStringsArray(value: any): value is TemplateStringsArray {
    return (
      Array.isArray(value) &&
      'raw' in value &&
      Array.isArray((value as any).raw)
    );
  }
}
