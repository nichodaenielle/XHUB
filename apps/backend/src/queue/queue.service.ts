import { Injectable, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('notifications') private notificationsQueue: Queue,
    @InjectQueue('emails') private emailsQueue: Queue,
    @InjectQueue('media') private mediaQueue: Queue,
  ) {}

  async addNotificationJob(data: any) {
    return this.notificationsQueue.add('send-notification', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  async addEmailJob(data: any) {
    return this.emailsQueue.add('send-email', data, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  }

  async addMediaProcessingJob(data: any) {
    return this.mediaQueue.add('process-media', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
    });
  }

  async addBulkNotificationJob(data: any[]) {
    return this.notificationsQueue.addBulk(
      data.map((item) => ({
        name: 'send-notification',
        data: item,
        opts: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      })),
    );
  }
}
