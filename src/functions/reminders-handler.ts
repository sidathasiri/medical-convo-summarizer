import { AppSyncResolverHandler } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBService } from '../services/dynamodb-service';
import { EventBridgeService } from '../services/eventbridge-service';
import { ReminderInput, Reminder, ReminderWithTTL } from '../types/reminder';

const dynamoDBService = new DynamoDBService();
const eventBridgeService = new EventBridgeService();

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
  return await dynamoDBService.listReminders(userId);
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
  const scheduleName = reminderId;

  // Convert to Unix timestamp for TTL (in UTC)
  const ttl = Math.floor(reminderDate.getTime() / 1000);
  const formattedDate = reminderDate.toISOString().split('.')[0];

  // Create EventBridge schedule
  await eventBridgeService.createSchedule(reminderId, formattedDate, input);

  const reminder: ReminderWithTTL = {
    id: reminderId,
    userId: input.userId,
    email: input.email,
    description: input.description,
    dateTime: input.dateTime,
    createdAt: new Date().toISOString(),
    ttl: ttl,
    scheduleName: scheduleName
  };

  // Store in DynamoDB
  await dynamoDBService.createReminder(reminder);

  return reminder;
}

async function deleteReminder(userId: string, id: string): Promise<boolean> {
  // Get the reminder first to get the schedule name
  const reminder = await dynamoDBService.getReminderById(userId, id);
  
  // Delete the EventBridge schedule
  if (reminder?.scheduleName) {
    try {
      await eventBridgeService.deleteSchedule(reminder.scheduleName);
    } catch (error) {
      console.error('Error deleting schedule:', error);
      // Continue with deletion even if schedule deletion fails
    }
  }

  // Delete from DynamoDB
  await dynamoDBService.deleteReminder(userId, id);

  return true;
}

function generateId(): string {
  return `rem_${uuidv4()}`;
}
