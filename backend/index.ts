import * as cdk from "aws-cdk-lib";
import "source-map-support/register";
import {videoShareAppStack} from "./stacks/video-share";

const app = new cdk.App();
new videoShareAppStack(app, "videoShareAppStack", {
    env: { region : "us-east-1" },
})