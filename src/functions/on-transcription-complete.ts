import { S3Event } from 'aws-lambda';
import fetch from 'node-fetch';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const APPSYNC_API_URL = process.env.APPSYNC_API_URL;
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

export const handler = async (event: S3Event) => {
  try {
    const record = event.Records[0];
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    const fileName = key.split('/').pop() || '';

    // Fetch and parse the S3 JSON file
    const getObjectResponse = await s3Client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
    const bodyContents = await getObjectResponse.Body?.transformToString();
    const s3Content = JSON.parse(bodyContents || '{}');
    const transcribedText = s3Content.results?.transcripts?.[0]?.transcript || '';

    // Prepare the GraphQL mutation
    const mutation = `
      mutation UpdateTranscriptionStatus($fileName: String!, $transcribedText: String) {
        updateTranscriptionStatus(fileName: $fileName, transcribedText: $transcribedText) {
          fileName
          transcribedText
          error
        }
      }
    `;

    const variables = {
      fileName,
      transcribedText,
    };

    if (!APPSYNC_API_URL) {
      throw new Error('APPSYNC_API_URL environment variable is not set');
    }

    // Call the AppSync API
    const response = await fetch(APPSYNC_API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': 'your-appsync-api-key' // Replace with your actual API key
      },
      body: JSON.stringify({ query: mutation, variables })
    });

    const result = await response.json();
    console.log('AppSync mutation result:', result);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Transcription status updated', result })
    };
  } catch (error) {
    console.error('Error updating transcription status:', error);
    throw error;
  }
};
