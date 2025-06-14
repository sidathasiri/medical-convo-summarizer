import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  QueryCommand, 
  DeleteCommand
} from '@aws-sdk/lib-dynamodb';
import { Reminder, ReminderWithTTL } from '../types/reminder';

export class DynamoDBService {
  private dynamoDb: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    this.dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({region: 'us-east-1'}));
    this.tableName = process.env.TABLE_NAME || '';
  }

  async listReminders(userId: string): Promise<Reminder[]> {
    const result = await this.dynamoDb.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    }));

    return result.Items as Reminder[];
  }

  async createReminder(reminder: ReminderWithTTL): Promise<void> {
    await this.dynamoDb.send(new PutCommand({
      TableName: this.tableName,
      Item: reminder
    }));
  }

  async getReminderById(userId: string, id: string): Promise<ReminderWithTTL | null> {
    const result = await this.dynamoDb.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'userId = :userId AND id = :id',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':id': id
      }
    }));

    return (result.Items?.[0] as ReminderWithTTL) || null;
  }

  async deleteReminder(userId: string, id: string): Promise<void> {
    await this.dynamoDb.send(new DeleteCommand({
      TableName: this.tableName,
      Key: { 
        userId,
        id 
      }
    }));
  }
}
