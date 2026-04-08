import { join } from 'path';
import { getPossibleConfigPaths, loadConfigFile } from '../config/loader';
import { isCompilerPlugin } from '../plugins';
import { createAppProcess } from './app-process';
import { buildApplication } from './build';
import { watch } from 'chokidar';
import { debounce } from '../utils/utilities';
import colors from '../utils/colors';
import { ChildProcess } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { COMMANDKIT_CWD, HMREventType } from '../utils/constants';
import { findEntrypoint } from './common';

/**
 * @private
 * @internal
 */
async function buildAndStart(configPath: string, skipStart = false) {
  const config = await loadConfigFile(configPath);
  const mainFile = findEntrypoint('.commandkit');

  await buildApplication({
    configPath,
    isDev: true,
    plugins: config.plugins.flat(2).filter((p) => isCompilerPlugin(p)),
    rolldownPlugins: config.rolldownPlugins,
  });

  if (skipStart) return null as never;

  const ps = createAppProcess(mainFile, configPath, true);

  return ps;
}

/**
 * @private
 * @internal
 */
const isCommandSource = (p: string) =>
  p.replaceAll('\\', '/').includes('src/app/commands');

/**
 * @private
 * @internal
 */
const isEventSource = (p: string) =>
  p.replaceAll('\\', '/').includes('src/app/events');

/**
 * @private
 * @internal
 */
export async function bootstrapDevelopmentServer(configPath?: string) {
  process.env.COMMANDKIT_BOOTSTRAP_MODE = 'development';
  process.env.COMMANDKIT_INTERNAL_IS_CLI_PROCESS = 'true';
  const start = performance.now();
  const cwd = configPath || COMMANDKIT_CWD;
  const configPaths = getPossibleConfigPaths(cwd);

  const watcher = watch([join(cwd, 'src'), ...configPaths], {
    ignoreInitial: true,
  });

  let ps: ChildProcess | null = null;

  const waitForAcknowledgment = (messageId: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!ps) return resolve(false);

      let _handled = false;
      const onMessage = (message: any) => {
        _handled = true;
        if (typeof message !== 'object' || message === null) return;

        const { type, id, handled } = message;
        if (type === 'commandkit-hmr-ack' && id === messageId) {
          ps?.off('message', onMessage);
          resolve(!!handled);
        }
      };

      ps.once('message', onMessage);

      if (!_handled) {
        sleep(3000).then(() => {
          ps?.off('message', onMessage);
          resolve(false);
        });
      }
    });
  };

  const sendHmrEvent = async (
    event: HMREventType,
    path?: string,
  ): Promise<boolean> => {
    if (!ps || !ps.send) return false;

    const messageId = randomUUID();
    const messagePromise = waitForAcknowledgment(messageId);

    ps.send({ event, path, id: messageId });

    // Wait for acknowledgment or timeout after 3 seconds
    try {
      let triggered = false;
      const res = !!(await Promise.race([
        messagePromise,
        sleep(3000).then(() => {
          if (!triggered) {
            console.warn(
              colors.yellow(
                `HMR acknowledgment timed out for event ${event} on path ${path}`,
              ),
            );
          }
          return false;
        }),
      ]));

      triggered = true;

      return res;
    } catch (error) {
      console.error(
        colors.red(`Error waiting for HMR acknowledgment: ${error}`),
      );
      return false;
    }
  };

  const performHMR = debounce(async (path?: string): Promise<boolean> => {
    if (!path || !ps) return false;

    let eventType: HMREventType | null = null;
    let eventDescription = '';

    if (isCommandSource(path)) {
      eventType = HMREventType.ReloadCommands;
      eventDescription = 'command(s)';
    } else if (isEventSource(path)) {
      eventType = HMREventType.ReloadEvents;
      eventDescription = 'event(s)';
    } else {
      eventType = HMREventType.Unknown;
      eventDescription = 'unknown source';
    }

    if (eventType) {
      console.log(
        `${colors.cyanBright(`Attempting to reload ${eventDescription} at`)} ${colors.yellowBright(path)}`,
      );

      await buildAndStart(cwd, true);
      const hmrHandled = await sendHmrEvent(eventType, path);

      if (hmrHandled) {
        console.log(
          `${colors.greenBright(`Successfully hot reloaded ${eventDescription} at`)} ${colors.yellowBright(path)}`,
        );
        return true;
      }
    }

    return false;
  }, 700);

  const isConfigUpdate = (path: string) => {
    const isConfig = configPaths.some((configPath) => path === configPath);

    if (!isConfig) return false;

    console.log(
      colors.yellowBright(
        'It seems like commandkit config file was updated, please restart the server manually to apply changes.',
      ),
    );

    return isConfig;
  };

  const hmrHandler = async (path: string) => {
    if (isConfigUpdate(path)) return;
    const hmr = await performHMR(path);
    if (hmr) return;

    console.log(
      `${colors.yellowBright('⚡️ Performing full restart due to the changes in')} ${colors.cyanBright(path)}`,
    );

    ps?.kill();
    ps = await buildAndStart(cwd);
  };

  process.stdin.on('data', async (d) => {
    const command = d.toString().trim();

    switch (command) {
      case 'r':
        console.log(`Received restart command, restarting...`);
        ps?.kill();
        ps = null;
        ps = await buildAndStart(cwd);
        break;
      case 'rc':
        console.log(`Received reload commands command, reloading...`);
        await sendHmrEvent(HMREventType.ReloadCommands);
        break;
      case 're':
        console.log(`Received reload events command, reloading...`);
        await sendHmrEvent(HMREventType.ReloadEvents);
        break;
        break;
    }
  });

  watcher.on('change', hmrHandler);
  watcher.on('add', hmrHandler);
  watcher.on('unlink', hmrHandler);
  watcher.on('unlinkDir', hmrHandler);
  watcher.on('error', (e) => {
    console.error(e);
  });

  console.log(`${colors.greenBright('Bootstrapped CommandKit Development Environment in')} ${colors.yellowBright(`${(performance.now() - start).toFixed(2)}ms`)}
${colors.greenBright('Watching for changes in')} ${colors.yellowBright('src')} ${colors.greenBright('directory')}

${colors.greenBright('Commands:')}
${colors.yellowBright('r')} - Restart the server
${colors.yellowBright('rc')} - Reload all commands
${colors.yellowBright('re')} - Reload all events`);

  const buildStart = performance.now();

  ps = await buildAndStart(cwd);

  const buildEnd = performance.now();

  console.log(
    `\n${colors.greenBright('Development mode compilation took')} ${colors.yellowBright(`${(buildEnd - buildStart).toFixed(2)}ms`)}\n`,
  );

  return {
    watcher,
    isConfigUpdate,
    performHMR,
    hmrHandler,
    sendHmrEvent,
    getProcess: () => ps,
    buildAndStart,
  };
}
