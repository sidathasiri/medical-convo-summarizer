import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });

export const getTranscriptionSummary = async (
  transcription: String
): Promise<String> => {
  try {
    const response = await bedrockClient.send(
      new InvokeModelCommand({
        modelId: "amazon.nova-pro-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: [
                {
                  text: `Summarize the following medical conversation between a docker and patient. Include: summary, medication details in a table, vaccination info, developmental advice, symptoms to monitor, and follow-up plan. Use plain language parents can understand. Return the output in structured markdown format. Return only the output no any other questions or explanations.
${transcription}`,
                },
              ],
            },
          ],
        }),
      })
    );

    // Parse the response
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody?.output.message.content[0]?.text;
  } catch (error) {
    console.error("Error:", error);
    throw new Error("Error retrieving transcription summary");
  }
};
