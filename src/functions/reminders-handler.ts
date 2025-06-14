import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  QueryCommand, 
  DeleteCommand
} from '@aws-sdk/lib-dynamodb';
import { 
  SchedulerClient, 
  CreateScheduleCommand,
  DeleteScheduleCommand 
} from "@aws-sdk/client-scheduler";
import { v4 as uuidv4 } from 'uuid';

const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const scheduler = new SchedulerClient({region: 'us-east-1'});
const { TABLE_NAME } = process.env;

type ReminderInput = {
  userId: string;
  description: string;
  dateTime: string;
  email: string; // Assuming email is part of the input
};

type Reminder = {
  id: string;
  userId: string;
  email: string;
  description: string;
  dateTime: string;
  createdAt: string;
};

type ReminderWithTTL = Reminder & {
    ttl: number; // Unix timestamp for TTL
    scheduleName: string; // Name of the EventBridge schedule
}

export const handler: AppSyncResolverHandler<any, any> = async (event) => {
  const { fieldName } = event.info;
  const args = event.arguments;

  try {
    switch (fieldName) {
      case 'listReminders':
        return await listReminders(args.userId);
      case 'createReminder':
        return await createReminder(args);
      case 'deleteReminder':
        return await deleteReminder(args.userId, args.id);
      default:
        throw new Error(`Unknown field name: ${fieldName}`);
    }
  } catch (error) {
    console.error(`Error in ${fieldName}:`, error);
    throw error;
  }
};

async function listReminders(userId: string): Promise<Reminder[]> {
  const result = await dynamoDb.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId
    }
  }));

  return result.Items as Reminder[];
}

async function createReminder(input: ReminderInput): Promise<Reminder> {
  // Validate the dateTime format (should be ISO 8601)
  if (!input.dateTime.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/)) {
    throw new Error('dateTime must be in ISO 8601 format (e.g., "2025-06-14T15:00:00Z" or "2025-06-14T15:00:00+05:30")');
  }

  // Parse the dateTime string which includes timezone information
  const reminderDate = new Date(input.dateTime);
  
  // Validate that the date is in the future
  if (reminderDate.getTime() <= Date.now()) {
    throw new Error('Reminder dateTime must be in the future');
  }

  // Generate IDs
  const reminderId = generateId();
  const scheduleName = reminderId; // Use the same ID for the schedule name

  // Convert to Unix timestamp for TTL (in UTC)
  const ttl = Math.floor(reminderDate.getTime() / 1000);
  const formattedDate = reminderDate.toISOString().split('.')[0]

  // Create EventBridge schedule
  try {
    await scheduler.send(new CreateScheduleCommand({
      Name: reminderId,
      ScheduleExpression: `at(${formattedDate})`, // Format: "at(YYYY-MM-DD HH:mm:ss)"
      Target: {
        Arn: process.env.PROCESS_REMINDER_FUNCTION_ARN,
        RoleArn: process.env.SCHEDULER_EXECUTION_ROLE_ARN,
        Input: JSON.stringify({
          type: 'REMINDER_DUE',
          reminder: {
            id: reminderId,
            userId: input.userId,
            email: input.email,
            description: input.description
          }
        })
      },
      FlexibleTimeWindow: {
        Mode: 'OFF'
      }
    }));
  } catch (error) {
    console.error('Failed to create schedule:', error);
    throw new Error('Failed to create reminder schedule');
  }

  const reminder: ReminderWithTTL = {
    id: reminderId,
    userId: input.userId,
    email: input.email, // Assuming email is part of the input
    description: input.description,
    dateTime: input.dateTime,
    createdAt: new Date().toISOString(),
    ttl: ttl,
    scheduleName: scheduleName
  };

  // Store in DynamoDB with scheduler name
  await dynamoDb.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: reminder
  }));

  return reminder;
}

async function deleteReminder(userId: string, id: string): Promise<boolean> {
  // Get the reminder first to get the schedule name
  const result = await dynamoDb.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'userId = :userId AND id = :id',
    ExpressionAttributeValues: {
      ':userId': userId,
      ':id': id
    }
  }));

  const reminder = result.Items?.[0] as ReminderWithTTL;
  
  // Delete the EventBridge schedule
  if (reminder?.scheduleName) {
    try {
      await scheduler.send(new DeleteScheduleCommand({
        Name: reminder.scheduleName
      }));
    } catch (error) {
      console.error('Error deleting schedule:', error);
      // Continue with deletion even if schedule deletion fails
    }
  }

  // Delete from DynamoDB
  await dynamoDb.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { 
      userId,
      id 
    }
  }));

  return true;
}

function generateId(): string {
  return `rem_${uuidv4()}`;
}
