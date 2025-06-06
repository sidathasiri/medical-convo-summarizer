import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import * as iam from "aws-cdk-lib/aws-iam";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

export class MedicalConvoSummarizerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create an S3 bucket
    const bucket = new s3.Bucket(this, "MedicalConvoBucket", {
      bucketName: "medical-convo-bucket",
      removalPolicy: cdk.RemovalPolicy.DESTROY, // This will allow the bucket to be deleted when the stack is destroyed
      autoDeleteObjects: true, // This will delete all objects when the bucket is removed
    });

    // Create the Lambda function for transcription summary
    const transcriptionSummaryFunction = new NodejsFunction(
      this,
      "TranscriptionSummaryFunction",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        functionName: "TranscriptionSummaryFunction",
        handler: "handler",
        entry: path.join(
          __dirname,
          "../src/functions/transcription-summary.ts"
        ),
        timeout: cdk.Duration.minutes(1),
      }
    );

    // Create the API Gateway with CORS enabled
    const api = new apigateway.RestApi(this, "MedicalConvoApi", {
      restApiName: "Medical Conversation API",
      description: "API for medical conversation transcription and summary",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "X-Api-Key",
          "X-Amz-Security-Token",
          "X-Amz-User-Agent",
        ],
        allowCredentials: true,
        maxAge: cdk.Duration.days(1),
      },
      deployOptions: {
        stageName: "prod",
      },
    });

    // Create the /transcription/summary resource and method
    const transcriptionResource = api.root.addResource("transcription");
    const summaryResource = transcriptionResource.addResource("summary");

    // Add POST method with Lambda integration
    summaryResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(transcriptionSummaryFunction, {
        proxy: true,
      })
    );

    // Grant Bedrock invoke permissions to the Lambda function
    transcriptionSummaryFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:InvokeModel"],
        resources: ["*"], // You can restrict this to specific model ARNs if needed
      })
    );

    // Output the API endpoint URL
    new cdk.CfnOutput(this, "ApiEndpoint", {
      value: api.url,
      description: "API Gateway endpoint URL",
    });
  }
}
