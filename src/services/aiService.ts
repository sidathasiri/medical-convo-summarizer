import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });
const modelId = "amazon.nova-pro-v1:0"

export const getTranscriptionSummary = async (
  transcription: String
): Promise<string> => {
  try {
    const response = await bedrockClient.send(
      new InvokeModelCommand({
        modelId ,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: [
                {
                  text: `Summarize the following medical conversation between a docker and patient. Include: summary, medication details in a table, vaccination info, developmental advice, symptoms to monitor, and follow-up plan. Use plain language parents can understand. Return the output in structured markdown format. If you don't find sufficient information to generate an accurate result, return "Unable to generate summary". Return only the output no any other questions or explanations.
"${transcription}"`,
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

export const getBabyDevelopmentInfo = async (
  ageInMonths: Number
): Promise<string> => {
  try {
    const response = await bedrockClient.send(
      new InvokeModelCommand({
        modelId ,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: [
                {
                  text: `As a pediatric expert, provide comprehensive information about baby development, health, and care for a ${ageInMonths}-month-old baby. Include below information in the response:
          - "milestones"
          - "healthConsiderations"
          - "dietaryGuidelines"
          - "warningSignsToWatch"
          - "commonIssues"
          - "developmentalActivities"

  Ensure each topic contains 3-5 most important points, written in clear, parent-friendly language. Return the response in markdown format. Return only the output no any other questions or explanations`,
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
