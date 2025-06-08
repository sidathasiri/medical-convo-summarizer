import { S3Event } from 'aws-lambda';
import { 
  TranscribeClient, 
  StartTranscriptionJobCommand,
  MediaFormat
} from "@aws-sdk/client-transcribe";
import { S3Client } from "@aws-sdk/client-s3";

const transcribeClient = new TranscribeClient({ region: "us-east-1" });
const s3Client = new S3Client({ region: "us-east-1" });

const getMediaFormat = (extension: string): MediaFormat => {
  switch (extension.toLowerCase()) {
    case 'mp3':
      return MediaFormat.MP3;
    case 'mp4':
      return MediaFormat.MP4;
    case 'wav':
      return MediaFormat.WAV;
    case 'flac':
      return MediaFormat.FLAC;
    default:
      throw new Error(`Unsupported media format: ${extension}`);
  }
};

export const handler = async (event: S3Event) => {
  try {
    const record = event.Records[0]; // Process the first record
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    // Only process files in the uploads directory
    if (!key.startsWith('uploads/')) {
      console.log('File not in uploads directory, skipping');
      return;
    }

    const fileName = key.split('/').pop();
    if (!fileName) {
      throw new Error('Could not determine file name');
    }

    const extension = fileName.split('.').pop();
    if (!extension) {
      throw new Error('Could not determine file extension');
    }

    // Create a unique job name
    const jobName = `transcribe-${fileName}-${Date.now()}`.replace(/[^a-zA-Z0-9-]/g, '-');

    // Configure the transcription job
    const command = new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      LanguageCode: 'en-US',
      MediaFormat: getMediaFormat(extension),
      Media: {
        MediaFileUri: `s3://${bucket}/${key}`
      },
      OutputBucketName: bucket,
      OutputKey: `transcribed/${fileName}.json`
    });

    // Start the transcription job
    const response = await transcribeClient.send(command);
    console.log(`Transcription job started: ${jobName}`, response);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Transcription job started successfully',
        jobName: jobName
      })
    };

  } catch (error) {
    console.error('Error starting transcription job:', error);
    throw error;
  }
};