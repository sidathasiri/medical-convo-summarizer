import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import * as iam from "aws-cdk-lib/aws-iam";
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

    // Create the Lambda function
    const generateMedicalSummary = new NodejsFunction(
      this,
      "GenerateMedicalSummaryFunction",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: "handler",
        entry: path.join(
          __dirname,
          "../src/functions/generate-medical-summary.ts"
        ),
        timeout: cdk.Duration.minutes(1),
      }
    );

    // Grant Bedrock invoke permissions to the Lambda function
    generateMedicalSummary.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:InvokeModel"],
        resources: ["*"], // You can restrict this to specific model ARNs if needed
      })
    );
  }
}
