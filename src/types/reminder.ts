export type ReminderInput = {
  userId: string;
  description: string;
  dateTime: string;
  email: string;
};

export type Reminder = {
  id: string;
  userId: string;
  email: string;
  description: string;
  dateTime: string;
  createdAt: string;
};

export type ReminderWithTTL = Reminder & {
  ttl: number;
  scheduleName: string;
};

export type ReminderEventPayload = {
  id: string;
  userId: string;
  email: string;
  description: string;
  dateTime: string;
};

export type ReminderEvent = {
  type: 'REMINDER_DUE';
  reminder: ReminderEventPayload;
};
