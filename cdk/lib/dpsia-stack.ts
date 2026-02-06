import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export class DPSIAStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Secrets Manager secret (must be pre-populated with API keys)
    const secret = secretsmanager.Secret.fromSecretNameV2(
      this, 'DPSIASecret', 'dpsia-lambda/config'
    );

    // Lambda function
    const fn = new lambda.Function(this, 'DPSIAFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('../dist', {
        // dist/ is produced by: npm run build
      }),
      memorySize: 1024,
      timeout: cdk.Duration.minutes(15),
      environment: {
        SECRETS_NAME: 'dpsia-lambda/config',
        NODE_OPTIONS: '--enable-source-maps',
      },
      logRetention: logs.RetentionDays.TWO_WEEKS,
      description: 'DPSIA assessor - performs vendor security assessments',
    });

    // Grant Lambda read access to the secret
    secret.grantRead(fn);

    // API Gateway REST API with API key authentication
    const api = new apigateway.RestApi(this, 'DPSIAApi', {
      restApiName: 'DPSIA Assessment API',
      description: 'API for triggering DPSIA vendor security assessments',
      deployOptions: {
        stageName: 'prod',
        throttlingRateLimit: 5,
        throttlingBurstLimit: 10,
      },
    });

    // API key + usage plan
    const apiKey = api.addApiKey('DPSIAApiKey', {
      apiKeyName: 'dpsia-api-key',
      description: 'API key for DPSIA assessment endpoint',
    });

    const usagePlan = api.addUsagePlan('DPSIAUsagePlan', {
      name: 'DPSIAStandard',
      description: 'Standard usage plan for DPSIA API',
      throttle: {
        rateLimit: 5,
        burstLimit: 10,
      },
      quota: {
        limit: 100,
        period: apigateway.Period.DAY,
      },
    });

    usagePlan.addApiKey(apiKey);
    usagePlan.addApiStage({ stage: api.deploymentStage });

    // POST /assess endpoint
    const assess = api.root.addResource('assess');
    assess.addMethod('POST', new apigateway.LambdaIntegration(fn, {
      timeout: cdk.Duration.seconds(29), // API Gateway max is 29s for sync
    }), {
      apiKeyRequired: true,
    });

    // Note: For long-running assessments (>29s), callers should use
    // Lambda invocation directly rather than API Gateway sync.
    // API Gateway has a hard 29-second timeout.

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'DPSIA API Gateway URL',
    });

    new cdk.CfnOutput(this, 'ApiKeyId', {
      value: apiKey.keyId,
      description: 'API Key ID (retrieve value from console)',
    });

    new cdk.CfnOutput(this, 'FunctionArn', {
      value: fn.functionArn,
      description: 'Lambda function ARN for direct invocation',
    });

    new cdk.CfnOutput(this, 'FunctionName', {
      value: fn.functionName,
      description: 'Lambda function name',
    });
  }
}
