import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { ReminderEvent } from '../types/reminder';

export class EmailService {
  private ses: SESClient;

  constructor() {
    this.ses = new SESClient({ region: 'us-east-1' });
  }

  async sendReminderEmail(event: ReminderEvent): Promise<void> {
    try {
      await this.ses.send(new SendEmailCommand({
        Destination: {
          ToAddresses: [event.reminder.email],
        },
        Message: {
          Body: {
            Html: {
              Data: this.getEmailHtmlContent(event),
            },
            Text: {
              Data: this.getEmailTextContent(event),
            },
          },
          Subject: {
            Data: "📅 CuddleScribe Reminder",
          },
        },
        Source: process.env.FROM_EMAIL_ADDRESS,
      }));
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  private getEmailHtmlContent(event: ReminderEvent): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 24px;
              color: #4a90e2;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .reminder-box {
              background-color: #f8f9fa;
              border-left: 4px solid #4a90e2;
              padding: 20px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">CuddleScribe</div>
            <div>Your Trusted Health Companion</div>
          </div>
          <div class="reminder-box">
            <h2>👋 Hello!</h2>
            <p style="font-size: 16px;">Here's your friendly reminder about:</p>
            <p style="font-size: 18px; color: #4a90e2; margin: 15px 0;">${event.reminder.description}</p>
            <p style="font-size: 14px; color: #666;">This was scheduled for: ${new Date(event.reminder.dateTime).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })} (IST)</p>
            <p style="font-size: 14px; margin-top: 15px;">We hope this reminder helps you stay on top of your healthcare journey!</p>
          </div>
          <div class="footer">
            <p>This reminder was sent by CuddleScribe - Making healthcare management easier.</p>
            <p>© ${new Date().getFullYear()} CuddleScribe. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;
  }

  private getEmailTextContent(event: ReminderEvent): string {
    return `Hello from CuddleScribe!

Here's your friendly reminder about: ${event.reminder.description}

This was scheduled for: ${new Date(event.reminder.dateTime).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })} (IST)

We hope this reminder helps you stay on top of your healthcare journey!

Best regards,
Your CuddleScribe Team`;
  }
}
