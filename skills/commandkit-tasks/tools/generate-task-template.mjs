#!/usr/bin/env node

const mode = process.argv[2] ?? 'static';

if (mode === 'dynamic') {
  console.log(`import { createTask } from '@commandkit/tasks';

await createTask({
  name: 'reminder',
  data: { userId: '123', message: 'hello' },
  schedule: Date.now() + 60000,
});`);
} else {
  console.log(`import { task } from '@commandkit/tasks';

export default task({
  name: 'daily-job',
  schedule: '0 0 * * *',
  async execute() {
    // do work
  },
});`);
}
