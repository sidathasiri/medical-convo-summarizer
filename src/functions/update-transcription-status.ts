import { AppSyncResolverHandler } from 'aws-lambda';

type Arguments = {
  fileName: string;
  jobName: string;
  status: TranscriptionStatus;
  transcriptFileKey?: string;
  transcribedText?: string;
  error?: string;
};

enum TranscriptionStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

type TranscriptionJobStatus = {
  fileName: string;
  jobName: string;
  status: TranscriptionStatus;
  transcribedText?: string;
  transcriptFileKey?: string;
  error?: string;
};

export const handler: AppSyncResolverHandler<Arguments, TranscriptionJobStatus> = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const { fileName, jobName, status, transcriptFileKey, transcribedText, error } = event.arguments;

  // Create the response object with all provided fields
  const response: TranscriptionJobStatus = {
    fileName,
    jobName,
    status,
    ...(transcriptFileKey && { transcriptFileKey }),
    ...(transcribedText && { transcribedText }),
    ...(error && { error })
  };

  // Log the response for debugging
  console.log('Response:', JSON.stringify(response, null, 2));

  return response;
};
