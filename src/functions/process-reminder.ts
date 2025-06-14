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
  };
}

export const handler: Handler<ReminderEvent> = async (event) => {
  console.log('Processing reminder:', event);

  try {
    // Send email notification
    await ses.send(new SendEmailCommand({
      Destination: {
        ToAddresses: [event.reminder.email],
      },
      Message: {
        Body: {
          Text: {
            Data: `Reminder: ${event.reminder.description}`,
          },
        },
        Subject: {
          Data: "Your Reminder",
        },
      },
      Source: process.env.FROM_EMAIL_ADDRESS,
    }));

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
