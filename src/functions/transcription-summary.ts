import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getTranscriptionSummary } from "../services/aiService";

interface TranscriptionRequest {
  transcription: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Parse the request body
    const body = JSON.parse(event.body || "{}") as TranscriptionRequest;

    // Validate the required transcription field
    if (!body.transcription) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "Missing required field: transcription",
        }),
      };
    }

    // TODO: Add your transcription processing logic here
    // For now, we'll just echo back the transcription
    const response = {
      message: "Summary generated successfully",
      transcription: await getTranscriptionSummary(body.transcription),
    };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("Error processing request:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Internal server error",
      }),
    };
  }
};
