/**
 * Email sending utility using nodemailer
 */

import * as nodemailer from 'nodemailer';
import { getEmailConfig, getAlertConfig } from '../config';

let transporter: nodemailer.Transporter | null = null;

/**
 * Get or create email transporter
 */
function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const config = getEmailConfig();
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.auth.user,
        pass: config.auth.pass,
      },
    });
  }
  return transporter;
}

/**
 * Send an email
 */
export async function sendEmail(
  subject: string,
  html: string,
  recipients?: string[]
): Promise<{ success: boolean; error?: string }> {
  const emailConfig = getEmailConfig();
  const alertConfig = getAlertConfig();

  const to = recipients || alertConfig.recipients;

  if (to.length === 0) {
    console.warn('No recipients configured for email alerts');
    return { success: false, error: 'No recipients configured' };
  }

  try {
    const transport = getTransporter();

    await transport.sendMail({
      from: emailConfig.from,
      to: to.join(', '),
      subject,
      html,
    });

    console.log(`Email sent successfully to ${to.length} recipients`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to send email:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Verify email configuration
 */
export async function verifyEmailConfig(): Promise<{ valid: boolean; error?: string }> {
  try {
    const transport = getTransporter();
    await transport.verify();
    return { valid: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { valid: false, error: errorMessage };
  }
}
