import type { RequestHandler } from 'express';
import { z } from 'zod';
import { sendEmail } from '../services/emailService';

export const forgotPasswordSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .pipe(z.email({ error: 'Please enter a valid email address' })),
});

export const forgotPassword: RequestHandler = async (req, res) => {
  const result = forgotPasswordSchema.safeParse(req.body ?? {});
  if (!result.success) {
    res.status(400).json({
      error: 'Invalid forgot password request',
      details: z.flattenError(result.error).fieldErrors,
    });
    return;
  }

  await sendEmail({
    to: result.data.email,
    subject: 'Reset your Friendshop password',
    html: `
  <!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;font-family:Arial,sans-serif;color:#222;">
    <h1 style="font-size:24px;">Reset your FriendShop password</h1>

    <p>We received a request to reset the password for your account.</p>

    <p>
      <a
        href="{{resetUrl}}"
        style="display:inline-block;padding:12px 20px;background:#2457c5;color:#fff;text-decoration:none;border-radius:4px;"
      >
        Reset password
      </a>
    </p>

    <p>This link expires after a short time and can only be used once.</p>
    <p>If you didn’t request a password reset, you can ignore this email.</p>

    <p style="font-size:12px;color:#666;">
      If the button doesn’t work, copy and paste this address into your browser:<br />
      <a href="{{resetUrl}}">{{resetUrl}}</a>
    </p>
  </body>
</html>
  `,
  });

  res.status(200).json({ message: 'Recovery email request sent.' });
};
