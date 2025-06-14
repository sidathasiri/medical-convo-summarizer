import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as appsync from "aws-cdk-lib/aws-appsync";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { GraphqlApi, SchemaFile, AuthorizationType } from "aws-cdk-lib/aws-appsync";
import { LambdaDestination } from "aws-cdk-lib/aws-s3-notifications";

interface MedicalConvoSummarizerStackProps extends cdk.StackProps {
  existingUserPoolId: string;
}

export class MedicalConvoSummarizerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MedicalConvoSummarizerStackProps) {
    super(scope, id, props);

    // Import the existing Cognito User Pool
    const userPool = cognito.UserPool.fromUserPoolId(
      this,
      'ExistingUserPool',
      props.existingUserPoolId
    );

    // Create DynamoDB table for reminders
    const remindersTable = new dynamodb.Table(this, 'RemindersTable', {
      tableName: 'medical-reminders',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development. Change for production
      timeToLiveAttribute: 'ttl', // Optional: if you want to automatically delete expired reminders
    });

    // Create IAM role for EventBridge scheduler to invoke Lambda
    const schedulerRole = new iam.Role(this, 'SchedulerRole', {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
      description: 'Role for EventBridge Scheduler to invoke Lambda function',
    });

    // Create the Lambda function for processing reminders
    const processReminderFunction = new NodejsFunction(
      this,
      "ProcessReminderFunction",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        functionName: "ProcessReminderFunction",
        handler: "handler",
        entry: path.join(
          __dirname,
          "../src/functions/process-reminder.ts"
        ),
        environment: {
          TABLE_NAME: remindersTable.tableName,
          FROM_EMAIL_ADDRESS: 'sidathasiri@hotmail.com',
        },
        timeout: cdk.Duration.seconds(30)
      }
    );

    // Grant DynamoDB permissions to the process reminder function
    remindersTable.grantReadWriteData(processReminderFunction);

    // Grant SES permissions to send emails
    processReminderFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: ["*"]
      })
    );

    // Allow EventBridge Scheduler to invoke the process reminder function
    processReminderFunction.grantInvoke(schedulerRole);

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
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool,
            defaultAction: appsync.UserPoolDefaultAction.ALLOW
          }
        },
        additionalAuthorizationModes: [
          {
            authorizationType: AuthorizationType.API_KEY,
            apiKeyConfig: {
              name: 'TranscriptionApiKey',
              description: 'API Key for transcription status updates',
              expires: cdk.Expiration.after(cdk.Duration.days(365))
            }
          }
        ]
      }
    });
    const transcriptionSummaryDataSource = appSyncGraphQLApi.addLambdaDataSource('transcription-summary-data-source', transcriptionSummaryFunction)

    transcriptionSummaryDataSource.createResolver('getTranscriptionSummary-resolver', {
      fieldName: 'getTranscriptionSummary',
      typeName: 'Query'
    })


    // Lambda for updateTranscriptionStatus mutation
    const updateTranscriptionStatusFunction = new NodejsFunction(
      this,
      "UpdateTranscriptionStatusFunction",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        functionName: "UpdateTranscriptionStatusFunction",
        handler: "handler",
        entry: path.join(
          __dirname,
          "../src/functions/update-transcription-status.ts"
        ),
      }
    );

    // Add as AppSync data source
    const updateTranscriptionStatusDataSource = appSyncGraphQLApi.addLambdaDataSource(
      'update-transcription-status-data-source',
      updateTranscriptionStatusFunction
    );

    // Attach resolver for the mutation
    updateTranscriptionStatusDataSource.createResolver('updateTranscriptionStatus-resolver', {
      fieldName: 'updateTranscriptionStatus',
      typeName: 'Mutation',
    })


    // Create the Lambda function for handling completed transcriptions
    const onTranscriptionCompleteFunction = new NodejsFunction(
      this,
      "OnTranscriptionCompleteFunction",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        functionName: "OnTranscriptionCompleteFunction",
        handler: "handler",
        entry: path.join(
          __dirname,
          "../src/functions/on-transcription-complete.ts"
        ),
        environment: {
          APPSYNC_API_URL: appSyncGraphQLApi.graphqlUrl,
        }
      }
    );

    // Grant the Lambda function read access to the bucket
    bucket.grantRead(onTranscriptionCompleteFunction);

    // Add S3 event notification for transcribed/ prefix, only for .json files
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new LambdaDestination(onTranscriptionCompleteFunction),
      { prefix: "transcribed/", suffix: ".json" }
    );


    // Add API Key to Lambda environment variables
    onTranscriptionCompleteFunction.addEnvironment('APPSYNC_API_KEY', appSyncGraphQLApi.apiKey || '');

    // Output important configuration
    new cdk.CfnOutput(this, "GraphQLUrl", {
      value: appSyncGraphQLApi.graphqlUrl,
      description: "AppSync GraphQL API URL",
    });

    // Create the Lambda function for baby development info
    const babyDevelopmentInfoFunction = new NodejsFunction(
      this,
      "BabyDevelopmentInfoFunction",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        functionName: "BabyDevelopmentInfoFunction",
        handler: "handler",
        entry: path.join(
          __dirname,
          "../src/functions/get-baby-development-info.ts"
        ),
        timeout: cdk.Duration.minutes(1),
      }
    );

    // Grant Bedrock invoke permissions to the Lambda function
    babyDevelopmentInfoFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:InvokeModel"],
        resources: ["*"],
      })
    );

    // Add as AppSync data source and create resolver
    const babyDevelopmentInfoDataSource = appSyncGraphQLApi.addLambdaDataSource(
      'baby-development-info-data-source',
      babyDevelopmentInfoFunction
    );

    babyDevelopmentInfoDataSource.createResolver('getBabyDevelopmentInfo-resolver', {
      fieldName: 'getBabyDevelopmentInfo',
      typeName: 'Query',
    });


    // Create the Lambda function for reminders
    const remindersFunction = new NodejsFunction(
      this,
      "RemindersFunction",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        functionName: "RemindersFunction",
        handler: "handler",
        entry: path.join(
          __dirname,
          "../src/functions/reminders-handler.ts"
        ),
        environment: {
          TABLE_NAME: remindersTable.tableName,
          PROCESS_REMINDER_FUNCTION_ARN: processReminderFunction.functionArn,
          SCHEDULER_EXECUTION_ROLE_ARN: schedulerRole.roleArn
        }
      }
    );

    // Grant DynamoDB permissions to the Lambda function
    remindersTable.grantReadWriteData(remindersFunction);

    // Grant EventBridge Scheduler permissions
    remindersFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "scheduler:CreateSchedule",
          "scheduler:DeleteSchedule",
          "scheduler:GetSchedule",
          "iam:PassRole"
        ],
        resources: ["*"]
      })
    );

    // Add as AppSync data source
    const remindersDataSource = appSyncGraphQLApi.addLambdaDataSource(
      'reminders-data-source',
      remindersFunction
    );

    // Attach resolvers for all reminder operations
    remindersDataSource.createResolver('listReminders-resolver', {
      typeName: 'Query',
      fieldName: 'listReminders',
    });

    remindersDataSource.createResolver('createReminder-resolver', {
      typeName: 'Mutation',
      fieldName: 'createReminder',
    });

    remindersDataSource.createResolver('deleteReminder-resolver', {
      typeName: 'Mutation',
      fieldName: 'deleteReminder',
    });
  }
}
