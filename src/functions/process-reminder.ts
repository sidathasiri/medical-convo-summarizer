import { Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  DeleteCommand
} from '@aws-sdk/lib-dynamodb';
import { EmailService } from '../services/email-service';

const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const emailService = new EmailService();
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
    await emailService.sendReminderEmail(event);

    console.log('Email sent successfully');
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
