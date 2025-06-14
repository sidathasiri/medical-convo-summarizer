import { 
  SchedulerClient, 
  CreateScheduleCommand,
  DeleteScheduleCommand 
} from "@aws-sdk/client-scheduler";
import { ReminderInput } from '../types/reminder';

export class EventBridgeService {
  private scheduler: SchedulerClient;

  constructor() {
    this.scheduler = new SchedulerClient({region: 'us-east-1'});
  }

  async createSchedule(
    reminderId: string, 
    formattedDate: string, 
    input: ReminderInput
  ): Promise<void> {
    try {
      await this.scheduler.send(new CreateScheduleCommand({
        Name: reminderId,
        ScheduleExpression: `at(${formattedDate})`,
        Target: {
          Arn: process.env.PROCESS_REMINDER_FUNCTION_ARN,
          RoleArn: process.env.SCHEDULER_EXECUTION_ROLE_ARN,
          Input: JSON.stringify({
            type: 'REMINDER_DUE',
            reminder: {
              id: reminderId,
              userId: input.userId,
              email: input.email,
              description: input.description,
              dateTime: input.dateTime
            }
          })
        },
        ActionAfterCompletion: 'DELETE',
        FlexibleTimeWindow: {
          Mode: 'OFF'
        }
      }));
    } catch (error) {
      console.error('Failed to create schedule:', error);
      throw new Error('Failed to create reminder schedule');
    }
  }

  async deleteSchedule(scheduleName: string): Promise<void> {
    try {
      await this.scheduler.send(new DeleteScheduleCommand({
        Name: scheduleName
      }));
    } catch (error) {
      console.error('Error deleting schedule:', error);
      // We might want to handle this error differently depending on the use case
      throw error;
    }
  }
}
