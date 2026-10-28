import nodemailer, { type SentMessageInfo, type Transporter } from 'nodemailer';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let transporter: Transporter<SentMessageInfo> | undefined;
let sender: string | undefined;

function getEmailTransport(): {
  transporter: Transporter<SentMessageInfo>;
  sender: string;
} {
  if (transporter && sender) {
    return { transporter, sender };
  }

  const mailSender = process.env.MAIL_SENDER;
  const appPassword = process.env.APP_PASSWORD;
  if (!mailSender || !appPassword) {
    throw new Error(
      'MAIL_SENDER and APP_PASSWORD environment variables must be set to send email',
    );
  }

  sender = mailSender;
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: mailSender,
      pass: appPassword,
    },
  });

  return { transporter, sender };
}

export async function sendEmail(
  message: EmailMessage,
): Promise<SentMessageInfo> {
  const { transporter: emailTransporter, sender: mailSender } =
    getEmailTransport();

  return emailTransporter.sendMail({
    from: mailSender,
    to: message.to,
    subject: message.subject,
    text: message.text,
    ...(message.html === undefined ? {} : { html: message.html }),
  });
}
