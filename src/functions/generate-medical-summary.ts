import { Context, APIGatewayProxyResult, APIGatewayEvent } from "aws-lambda";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });

export const handler = async (
  event: APIGatewayEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log("Event: ", event);

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
May I come in doctor? Yes, come in. Take your seat. Thank you, doctor. Um, what's your name? Simran? Per? Hm. And how old are you? I'm 29. Ok. Now, tell me, um, what are the problems that you are facing since yesterday night? I've been having severe stomachache. Um, I took an antacid last night but the pain was still the same. Hm. Any other symptoms? Yeah. I also had bouts of vomiting last night and today morning as well. Do you have a headache? No. Did you have this kind of a stomachache before? Yes. Doctor. Um, I had it once before, how many days ago, almost three months ago. But at that time the pain stopped after I took an antacid. Hm. Um, please lie on that bed. I have to check. Ok. Doctor. Does it hurt here? Yes. Doctor. It hurts a lot. Ok. You can get it. Now. Um, is it something serious? Doctor? I can't say no, I'm writing down some tests. Try to do this by today. But what about now? I can't even walk properly because of the pain. Hm. I understand. I'm giving you an injection for temporary relief. Uh, injection. Uh um Do you have any medicine? Why are you scared of injections? Um It's not like that. Uh I mean it would be better if you could give me some medicine, nothing will happen. You won't even feel it. Look at that side, please. Doctor. Be careful. You can open your eyes now. It's already done. Oh, it's done. Thank you so much. I did not feel anything at all after receiving the test reports, bring them to me as soon as possible. Um, there is nothing to fear, right? Don't be so scared beforehand. Let's see. The reports first. Won't you give me any medicines? Doctor? Hm. I'm prescribing this medicine. It's just for today. Take it after your dinner. Ok. Doctor. Um, where should I submit the fees? Please submit that in the cash counter. Thank you, doctor. Welcome. May I come in doctor? Oh, yes. Come in please. Here are the reports of the tests that you gave. Oh, yeah. Um, let me check them. Hm. It's not that serious. Nothing to worry about. It was just food poisoning. Um I'm writing down the medicines. Um, please take them uh for one week after dinner. Oh, ok. Doctor. Um and if you face this problem again, come back immediately. Sure, doctor. Thank you. You're welcome. So this was the conversation. I hope you liked it. Now is the time for the question. The question is, what was the age of the patient? Make sure to answer this question in the comment box below. I eagerly be waiting for your answers. And if you like this conversation, then click on the like button. And if you want more such conversations like this and haven't subscribed my channel yet, then make sure to click on the subscribe button and share this video with your friends and family. That's it for today. Meet you in the next video with another interesting topic. Thank you. Bye.`,
                },
              ],
            },
          ],
        }),
      })
    );

    // Parse the response
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const result = responseBody?.output.message.content[0]?.text;
    console.log("result:", result);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Successfully invoked Bedrock model",
        response: result,
      }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error invoking Bedrock model",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
