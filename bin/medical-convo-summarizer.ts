#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { MedicalConvoSummarizerStack } from "../lib/medical-convo-summarizer-stack";

const app = new cdk.App();
new MedicalConvoSummarizerStack(app, "MedicalConvoSummarizerStack", {
  env: { account: "your_account_id", region: "aws_region" },
  existingUserPoolId: 'your_user_pool_id', // Replace with your actual User Pool ID
});
