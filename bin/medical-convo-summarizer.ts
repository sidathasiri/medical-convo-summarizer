#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { MedicalConvoSummarizerStack } from "../lib/medical-convo-summarizer-stack";

const app = new cdk.App();
new MedicalConvoSummarizerStack(app, "MedicalConvoSummarizerStack", {
  env: { account: "826406658508", region: "us-east-1" },
  existingUserPoolId: 'us-east-1_SiFC5wK0S'
});
