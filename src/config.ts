//module for storing the configuration for SMTP transport implemented in Nodemailer

import type { Options as SMTPTransportOptions } from 'nodemailer/lib/smtp-transport';

export const mailConfig: SMTPTransportOptions = {
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD,
  },
};
