import { EventBridgeHandler } from "aws-lambda";
import {VideoDB, VideoIndex} from "../entity/video";
import { MediaConvertEventHandler as Env } from "../lib/lambdaEnv";
import { S3 } from "../lib/s3";
import {OpenSearchClient} from "../lib/openSearch-client";

const env = process.env as Env;

const videoDb = new VideoDB({
    region: env.VIDEO_TABLE_REGION || "ap-south-1",
    tableName: env.VIDEO_TABLE_NAME || "test-table",
});
const uploadBucket = new S3({
    bucketName: env.UPLOAD_BUCKET_NAME || "test-bucket",
    region: env.UPLOAD_BUCKET_REGION || "ap-south-1",
});

const videoIndex = new VideoIndex(
    new OpenSearchClient({
        region: env.OPENSEARCH_REGION || "us-east-1",
        endpoint: env.OPENSEARCH_ENDPOINT || "https://test-endpoint.com",
    })
);

export const handler:EventBridgeHandler<"", {
    status: "PROGRESSING" | "COMPLETE" | "ERROR";
    userMetadata: {
        id: string;
    };
},any> = async (e) =>{
    try {
        const id = e.detail.userMetadata.id;
        if (!id) throw new Error("No video id provided in the metadata");
        const status = e.detail.status;

        switch (status) {
            case "COMPLETE":
                await videoDb.update({
                    id: e.detail.userMetadata.id,
                    attrs: {
                        status: "READY",
                    },
                });
                await uploadBucket.deleteObject(id);
                await videoIndex.putVideo(await videoDb.get(e.detail.userMetadata.id))
                break;
            case "PROGRESSING":
                await videoDb.update({
                    id: e.detail.userMetadata.id,
                    attrs: {
                        status: "PROCESSING",
                    },
                });
                break;
            case "ERROR":
                await videoDb.update({
                    id: e.detail.userMetadata.id,
                    attrs: {
                        status: "ERROR",
                    },
                });
                await uploadBucket.deleteObject(id);
                break;

            default:
                break;
        }
    } catch (error) {
        console.log(error);
    }
}