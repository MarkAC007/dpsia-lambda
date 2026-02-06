#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DPSIAStack } from '../lib/dpsia-stack';

const app = new cdk.App();

new DPSIAStack(app, 'DPSIAStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'eu-west-1',
  },
  description: 'DPSIA Lambda - Data Protection & Security Impact Assessment service',
});
