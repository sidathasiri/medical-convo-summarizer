import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  QueryCommand, 
  DeleteCommand
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const { TABLE_NAME } = process.env;

type ReminderInput = {
  userId: string;
  description: string;
  dateTime: string;
};

type Reminder = {
  id: string;
  userId: string;
  description: string;
  dateTime: string;
  createdAt: string;
};

type ReminderWithTTL = Reminder & {
    ttl: number; // Unix timestamp for TTL
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

  // Convert to Unix timestamp for TTL (in UTC)
  const ttl = Math.floor(reminderDate.getTime() / 1000);

  const reminder: ReminderWithTTL = {
    id: generateId(),
    userId: input.userId,
    description: input.description,
    dateTime: input.dateTime,
    createdAt: new Date().toISOString(),
    ttl: ttl
  };

  await dynamoDb.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: reminder
  }));

  return reminder;
}

async function deleteReminder(userId: string, id: string): Promise<boolean> {
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
