import { AppSyncResolverHandler } from "aws-lambda";
import { getTranscriptionSummary } from "../services/aiService";

type Arguments = {
  transcription: string;
};

type TranscriptionSummaryResult = {
  success: boolean;
  error?: string;
  summary?: string;
};

export const handler: AppSyncResolverHandler<
  Arguments,
  TranscriptionSummaryResult
> = async (event) => {
  try {
    console.log('event:', event);
    
    // Validate the required transcription field
    if (!event.arguments.transcription) {
      return {
        success: false,
        error: "Missing required field: transcription",
      };
    }

    // Get the transcription summary using the AI service
    const summaryText = await getTranscriptionSummary(event.arguments.transcription);

    return {
      success: true,
      summary: summaryText as string,
    };
  } catch (error) {
    console.error("Error processing request:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    };
  }
};
