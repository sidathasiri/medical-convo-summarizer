import { Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  DeleteCommand
} from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ses = new SESClient({ region: 'us-east-1' });
const { TABLE_NAME } = process.env;

type ReminderEvent = {
  type: 'REMINDER_DUE';
  reminder: {
    id: string;
    userId: string;
    email: string;
    description: string;
    dateTime: string;
  };
}

export const handler: Handler<ReminderEvent> = async (event) => {
  console.log('Processing reminder:', event);

  try {
    // Send email notification
    const response = await ses.send(new SendEmailCommand({
      Destination: {
        ToAddresses: [event.reminder.email],
      },
      Message: {
        Body: {
          Html: {
            Data: `
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
            `,
          },
          Text: {
            Data: `Hello from CuddleScribe!

Here's your friendly reminder about: ${event.reminder.description}

This was scheduled for: ${new Date(event.reminder.dateTime).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })} (IST)

We hope this reminder helps you stay on top of your healthcare journey!

Best regards,
Your CuddleScribe Team`,
          },
        },
        Subject: {
          Data: "📅 CuddleScribe Reminder",
        },
      },
      Source: process.env.FROM_EMAIL_ADDRESS,
    }));

    console.log('Email sent:', response);
    // Delete the reminder from DynamoDB as it's now processed
    await dynamoDb.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { 
        userId: event.reminder.userId,
        id: event.reminder.id
      }
    }));

    console.log('Reminder processed successfully:', event.reminder);
    return { success: true };
  } catch (error) {
    console.error('Error processing reminder:', error);
    throw error;
  }
};
