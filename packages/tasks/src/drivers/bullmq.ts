import { TaskDriver, TaskRunner } from '../driver';
import { ConnectionOptions, Queue, Worker } from 'bullmq';
import { TaskData } from '../types';

/**
 * BullMQ-based task driver for distributed task scheduling.
 *
 * This driver uses BullMQ to provide robust, distributed task scheduling with Redis
 * as the backend. It supports both cron expressions and date-based scheduling, with
 * built-in retry mechanisms and job persistence.
 *
 * **Requirements**: Requires the `bullmq` package to be installed.
 *
 * @example
 * ```ts
 * import { BullMQDriver } from '@commandkit/tasks/bullmq';
 * import { setDriver } from '@commandkit/tasks';
 *
 * const driver = new BullMQDriver({
 *   host: 'localhost',
 *   port: 6379,
 * }, 'my-tasks-queue');
 *
 * setDriver(driver);
 * ```
 *
 * @example
 * ```ts
 * // With custom Redis connection options
 * const driver = new BullMQDriver({
 *   host: 'redis.example.com',
 *   port: 6379,
 *   password: 'your-password',
 *   tls: true,
 * });
 * ```
 */
export class BullMQDriver implements TaskDriver {
  private runner: TaskRunner | null = null;

  /** The BullMQ queue instance for managing tasks */
  public readonly queue: Queue;

  /** The BullMQ worker instance for processing tasks */
  public readonly worker: Worker;

  /**
   * Creates a new BullMQ driver instance.
   *
   * @param connection - Redis connection options for BullMQ
   * @param queueName - Optional queue name, defaults to 'commandkit-tasks'
   */
  public constructor(
    connection: ConnectionOptions,
    private readonly queueName: string = 'commandkit-tasks',
  ) {
    this.queue = new Queue(this.queueName, { connection });
    this.worker = new Worker(
      this.queueName,
      async (job) => {
        if (!this.runner) throw new Error('Task runner has not been set');

        await this.runner({
          name: job.name,
          data: job.data,
          timestamp: job.timestamp,
        });
      },
      { connection },
    );
  }

  /**
   * Creates a new scheduled task in BullMQ.
   *
   * For cron tasks, this creates a repeating job with the specified cron pattern.
   * For date tasks, this creates a delayed job that executes at the specified time.
   *
   * @param task - The task data containing name, schedule, and custom data
   * @returns A unique job identifier
   */
  public async create(task: TaskData): Promise<string> {
    const taskId = `${task.name}-${typeof task.schedule === 'string' ? 'scheduled' : crypto.randomUUID()}`;
    const job = await this.queue.add(task.name, task.data, {
      ...(typeof task.schedule === 'string'
        ? {
            repeat: {
              pattern: task.schedule,
              tz: task.timezone,
              immediately: !!task.immediate,
            },
          }
        : {
            delay:
              (task.schedule instanceof Date
                ? task.schedule.getTime()
                : task.schedule) - Date.now(),
          }),
      jobId: taskId,
      removeOnComplete: true,
      removeOnFail: true,
    });

    return job.id ?? taskId;
  }

  /**
   * Deletes a scheduled task from BullMQ.
   *
   * This removes the job and all its children (for repeating jobs) from the queue.
   *
   * @param identifier - The job identifier to delete
   */
  public async delete(identifier: string): Promise<void> {
    await this.queue.remove(identifier, { removeChildren: true });
  }

  /**
   * Sets the task execution runner function.
   *
   * This function will be called by the BullMQ worker when a job is due for execution.
   *
   * @param runner - The function to call when a task should be executed
   */
  public async setTaskRunner(runner: TaskRunner): Promise<void> {
    this.runner = runner;
  }
}
