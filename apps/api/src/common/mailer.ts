import { logger } from './logger.js';

export interface EmailMessage {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  sentAt: Date;
}

const inMemoryMailbox: EmailMessage[] = [];

export const mailer = {
  async sendEmail(options: {
    to: string;
    subject: string;
    html?: string;
    text?: string;
  }): Promise<EmailMessage> {
    const message: EmailMessage = {
      ...options,
      sentAt: new Date(),
    };

    inMemoryMailbox.push(message);

    logger.info(
      {
        to: options.to,
        subject: options.subject,
      },
      `[Mailer Mock] Email dispatched to ${options.to}: "${options.subject}"`,
    );

    return message;
  },

  getSentEmails(): EmailMessage[] {
    return [...inMemoryMailbox];
  },

  getLastEmail(): EmailMessage | undefined {
    return inMemoryMailbox[inMemoryMailbox.length - 1];
  },

  clearSentEmails(): void {
    inMemoryMailbox.length = 0;
  },
};
