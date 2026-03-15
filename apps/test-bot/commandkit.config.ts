import { defineConfig, noBuildOnly } from 'commandkit/config';
import { i18n } from '@commandkit/i18n';
import { devtools } from '@commandkit/devtools';
import { cache } from '@commandkit/cache';
import { ai } from '@commandkit/ai';
import { tasks, setDriver } from '@commandkit/tasks';
import { SQLiteDriver } from '@commandkit/tasks/sqlite';
import { workflow } from '@commandkit/workflow';
import { ratelimit } from '@commandkit/ratelimit';

noBuildOnly(() => {
  setDriver(new SQLiteDriver());
  // setDriver(
  //   new BullMQDriver({
  //     maxRetriesPerRequest: null,
  //   }),
  // );
})();

export default defineConfig({
  plugins: [
    i18n(),
    devtools(),
    cache(),
    ratelimit(),
    ai(),
    tasks({
      initializeDefaultDriver: false,
    }),
    workflow(),
  ],
});
