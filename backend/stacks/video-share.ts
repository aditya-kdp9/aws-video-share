import * as cdk from 'aws-cdk-lib';
import * as lambdaFn from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as event from "aws-cdk-lib/aws-events";
import * as eventTarget from "aws-cdk-lib/aws-events-targets";
import { resolve } from 'path';
import * as apiGateway from 'aws-cdk-lib/aws-apigateway';
import * as lambdaEnvType from '../../lib/lambdaEnv';
import { Construct } from "constructs";
import * as s3Notification from "aws-cdk-lib/aws-s3-notifications";
import { Domain, EngineVersion } from "aws-cdk-lib/aws-opensearchservice";
import * as crProvider from "aws-cdk-lib/custom-resources";


export class videoShareAppStack extends cdk.Stack {
   constructor(scope: Construct, id: string, props?: cdk.StackProps) {
       super(scope, id, props);

       // DynamoDB

    const table =   new dynamodb.Table(this, 'VideoTable', {
           partitionKey: {
               name: 'id',
               type: dynamodb.AttributeType.STRING,
           },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
       });

    table.addGlobalSecondaryIndex({ indexName: "byUserId", partitionKey: {
            name: 'userId',
            type: dynamodb.AttributeType.STRING,
        },
        sortKey: {
            name: 'uploadedTime',
            type: dynamodb.AttributeType.NUMBER,
        }
    });

       //Upload Video Bucket ( S3)

       const uploadBucket = new s3.Bucket(this, 'UploadBucket', {
           removalPolicy: cdk.RemovalPolicy.DESTROY,
       });

       // MediaConvertRole
       const mediaConvertRole = new iam.Role(this, "MediaConvertRole", {
           assumedBy: new iam.ServicePrincipal("mediaconvert.amazonaws.com"),
       });

       // Stream Bucket

       const streamBucket = new s3.Bucket(this, "StreamBucket", {
           removalPolicy: cdk.RemovalPolicy.DESTROY,
           publicReadAccess: true,
           blockPublicAccess: {
               blockPublicAcls: false,
               blockPublicPolicy: false,
               ignorePublicAcls: false,
               restrictPublicBuckets: false,
           },
       });

       // Opensearch
       const domain = new Domain(this, "Domain", {
           version: EngineVersion.OPENSEARCH_2_3,
           capacity: {
               dataNodes: 1,
               dataNodeInstanceType: "t3.small.search",
           },
           removalPolicy: cdk.RemovalPolicy.DESTROY,
       });

       const openSearchEndpoint = `https://${domain.domainEndpoint}`;

       // openSearch index

       const opensearchIndexCreatorLambda = new lambdaFn.NodejsFunction(
           this,
           "OpensearchIndexCreatorLambda",
           {
               entry: resolve(__dirname, "../lambdas/openSearch-index.ts"),
           }
       );

       domain.grantReadWrite(opensearchIndexCreatorLambda);

       new cdk.CustomResource(this, "OpenSearchVideoIndex", {
          serviceToken: new crProvider.Provider(this, "CustomResourceLambdaProvider", {
              onEventHandler:  opensearchIndexCreatorLambda,
          }).serviceToken,
           properties: {
               endpoint: openSearchEndpoint,
               region: this.region,
               indexName: "video",
               indexProperties: {
                   mappings: {
                       properties: {
                           title: { type: "text" },
                           description: { type: "text" },
                           tags: { type: "text" },
                       },
                   },
               },
           },
       });

       // MediaConvertEventHandler

       const mediaConvertEventHandlerEnv: lambdaEnvType.MediaConvertEventHandler =
           {
               UPLOAD_BUCKET_NAME: uploadBucket.bucketName,
               UPLOAD_BUCKET_REGION: this.region,
               VIDEO_TABLE_NAME: table.tableName,
               VIDEO_TABLE_REGION: this.region,
               OPENSEARCH_ENDPOINT: openSearchEndpoint,
               OPENSEARCH_REGION: this.region,
           };

       const mediaConvertEventHandler = new lambdaFn.NodejsFunction(
           this,
           "MediaConvertEventHandler",
           {
               entry: resolve(__dirname, "../../lambdas/mediaConvertEventHandler.ts"),
               environment: mediaConvertEventHandlerEnv,
           }
       );

       // VideoCrud Handler
       const videoCrudHandlerEnv: lambdaEnvType.VideoCrudHandler = {
           VIDEO_TABLE_NAME: table.tableName,
           VIDEO_TABLE_REGION: this.region,
           UPLOAD_BUCKET_NAME: uploadBucket.bucketName,
           UPLOAD_BUCKET_REGION: this.region,
           OPENSEARCH_ENDPOINT: openSearchEndpoint,
           OPENSEARCH_REGION: this.region,
       };
       const videoCrudHandler = new lambdaFn.NodejsFunction(
           this,
           "videoCrudHandler",
           {
               entry: resolve(__dirname, "../../lambdas/videoCrudHandler.ts"),
               environment: videoCrudHandlerEnv,
           }
       );

       //S3 Event Handler

       const s3EventListenerEnv: lambdaEnvType.S3EventListener = {
           VIDEO_TABLE_REGION: this.region,
           VIDEO_TABLE_NAME: table.tableName,
           MEDIA_INFO_CLI_PATH: './mediainfo',
           UPLOAD_BUCKET_NAME: uploadBucket.bucketName,
           UPLOAD_BUCKET_REGION: this.region,
           MEDIA_CONVERT_ENDPOINT:
               "https://mediaconvert.us-east-1.amazonaws.com",
           MEDIA_CONVERT_OUTPUT_BUCKET: streamBucket.bucketName,
           MEDIA_CONVERT_REGION: this.region,
           MEDIA_CONVERT_ROLE_ARN: mediaConvertRole.roleArn,
       }

       const s3EventListener = new lambdaFn.NodejsFunction(this, 'S3EventListener', {
           entry: resolve(__dirname, '../../lambdas/s3EventListener.ts'),
           environment: s3EventListenerEnv,
           timeout: cdk.Duration.seconds(15),
           bundling: {
               commandHooks : {
                   beforeBundling(inputDir: string, outputDir: string): string[] {
                       return [];
                   },
                   afterBundling(inputDir: string, outputDir: string): string[] {
                       return [`cp '${inputDir}/lambda-binary/mediainfo' '${outputDir}'`];
                   },
                   beforeInstall() {
                       return [];
                   }
               }
           }
       });

       // MediaConvertJobStateChangeRule

       new event.Rule(this, "MediaConvertJobStateChangeRule", {
           eventPattern: {
               source: ["aws.mediaconvert"],
               detailType: ["MediaConvert Job State Change"],
               detail: {
                   status: ["ERROR", "COMPLETE", "PROGRESSING"],
               },
           },
           targets: [new eventTarget.LambdaFunction(mediaConvertEventHandler)],
       });

       // API gateway
       const mainApi = new apiGateway.RestApi(this, 'videoShareApi', {
           deploy: false
       });
       mainApi.root.addResource("video").addMethod("ANY", new apiGateway.LambdaIntegration(videoCrudHandler));

       mainApi.deploymentStage = new apiGateway.Stage(this, 'videoShareApiDevStage', {
           stageName: 'dev',
           deployment: new apiGateway.Deployment(this, 'videoShareApiDevDeployment', {
               api: mainApi,
           }),
       }
       );

       // upload bucket notification

       uploadBucket.addObjectCreatedNotification(new s3Notification.LambdaDestination(s3EventListener));

       //Permissions

       table.grantReadWriteData(videoCrudHandler);
       table.grantWriteData(s3EventListener);
       table.grantReadWriteData(mediaConvertEventHandler);
       uploadBucket.grantPut(videoCrudHandler);
       uploadBucket.grantRead(s3EventListener);
       uploadBucket.grantDelete(mediaConvertEventHandler);
       uploadBucket.grantRead(mediaConvertRole);
       streamBucket.grantWrite(mediaConvertRole);
       domain.grantReadWrite(videoCrudHandler);
       domain.grantReadWrite(mediaConvertEventHandler);

       domain.addAccessPolicies(
           new iam.PolicyStatement({
               actions: ["*"],
               effect: iam.Effect.ALLOW,
               principals: [
                   new iam.ArnPrincipal(
                       "arn:aws:iam::141884504720:user/open-search-admin"
                   ),
               ],
               resources: ["*"],
           })
       );

       s3EventListener.role?.attachInlinePolicy(
           new iam.Policy(this, "S3EventListenerPolicy#passRole", {
               statements: [
                   new iam.PolicyStatement({
                       actions: ["iam:PassRole", "mediaconvert:CreateJob"],
                       resources: ["*"],
                   }),
               ],
           })
       );

   }
}