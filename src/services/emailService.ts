import nodemailer, { type SendMailOptions } from 'nodemailer';
import { mailConfig } from '../config';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export const sendEmail = async (options: SendMailOptions) => {
  const transporter = nodemailer.createTransport(mailConfig);

  const mailOptions: SendMailOptions = {
    from: process.env.SENDER_EMAIL,
    to: process.env.RECEIVER_EMAIL,
    ...options,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
  } catch (error) {
    console.error('Error sending email', error);
  }
};
