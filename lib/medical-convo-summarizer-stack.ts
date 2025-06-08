import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import * as iam from "aws-cdk-lib/aws-iam";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { GraphqlApi, SchemaFile } from "aws-cdk-lib/aws-appsync";
import { LambdaDestination } from "aws-cdk-lib/aws-s3-notifications";

export class MedicalConvoSummarizerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create an S3 bucket
    const bucket = new s3.Bucket(this, "MedicalConvoBucket", {
      bucketName: "medical-convo-bucket",
      removalPolicy: cdk.RemovalPolicy.DESTROY, // This will allow the bucket to be deleted when the stack is destroyed
      autoDeleteObjects: true, // This will delete all objects when the bucket is removed
      cors: [
        {
          allowedHeaders: ["*"],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: ["*"], // In production, you should restrict this to your frontend domain
          exposedHeaders: [
            "ETag",
            "x-amz-server-side-encryption",
            "x-amz-request-id",
            "x-amz-id-2",
          ],
          maxAge: 3000,
        },
      ],
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

    // Grant Bedrock invoke permissions to the Lambda function
    transcriptionSummaryFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:InvokeModel"],
        resources: ["*"], // You can restrict this to specific model ARNs if needed
      })
    );

    // Create the Lambda function for transcription summary
    const startTranscriptionJobFunction = new NodejsFunction(
      this,
      "StartTranscriptionJobFunction",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        functionName: "StartTranscriptionJobFunction",
        handler: "handler",
        entry: path.join(
          __dirname,
          "../src/functions/start-transcription.ts"
        ),
      }
    );

    // Grant Transcribe permissions to the Lambda function
    startTranscriptionJobFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["transcribe:StartTranscriptionJob"],
        resources: ["*"],
      })
    );

    // Grant the Lambda function read AND write access to the bucket
    bucket.grantReadWrite(startTranscriptionJobFunction);

    // Add S3 event notification for uploads/ prefix
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new LambdaDestination(startTranscriptionJobFunction),
      { prefix: "uploads/" }
    );

    const appSyncGraphQLApi = new GraphqlApi(this, `graphql-api-${id}`, {
      name: `Medical-Conversation-API`,
      schema: SchemaFile.fromAsset("src/schema/schema.graphql"),
    });
    const transcriptionSummaryDataSource = appSyncGraphQLApi.addLambdaDataSource('transcription-summary-data-source', transcriptionSummaryFunction)

    transcriptionSummaryDataSource.createResolver('getTranscriptionSummary-resolver', {
      fieldName: 'getTranscriptionSummary',
      typeName: 'Query'
    })


    // Output the API endpoint URL
    new cdk.CfnOutput(this, "GraphQLUrl", {
      value: appSyncGraphQLApi.graphqlUrl,
      description: "AppSync Graphql endpoint URL",
    });
  }
}
