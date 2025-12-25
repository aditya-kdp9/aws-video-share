import { v4 } from "uuid";
import { APIGatewayProxyHandler } from "aws-lambda";
import {z} from "zod";
import {S3} from "../lib/s3";
import {VideoDB, VideoIndex} from "../entity/video";
import {withValidation} from "../lib/handlers/api";
import { VideoCrudHandler as Env} from '../lib/lambdaEnv';
import {KnownError} from "../lib/error";
import {OpenSearchClient} from "../lib/openSearch-client";

const env = process.env as Env;

const s3 = new S3({
    bucketName: env.UPLOAD_BUCKET_NAME || 'video-share-aditya-bucket',
    region: env.UPLOAD_BUCKET_REGION || 'us-east-1',
});

const videoDB = new VideoDB({
    tableName: env.VIDEO_TABLE_NAME || 'video-share',
    region: env.VIDEO_TABLE_REGION || 'us-east-1',
});

const videoIndex = new VideoIndex(new OpenSearchClient({
    endpoint: env.OPENSEARCH_ENDPOINT,
    region: env.OPENSEARCH_REGION
}))

export const handler: APIGatewayProxyHandler = (...params) => {
    switch (params[0].httpMethod) {
        case "PUT":
            return withValidation({
                bodySchema: z.object({
                    userId: z.string(),
                    title: z.string(),
                    description: z.string().optional(),
                    tags: z.array(z.string()).optional(),
                }),
                async handler({ title, userId, description, tags }) {
                    const id = v4();

                    await videoDB.save({
                        id,
                        status: "NOT_UPLOADED",
                        title,
                        userId,
                        uploadedTime: Date.now(),
                        description,
                        tags,
                    });
                    return {
                        uploadUrl: await s3.getUploadUrl({
                            key: id,
                            expiresIn: 60 * 10,
                        }),
                    };
                },
            })(...params);

        case "GET":

            return withValidation({
                querySchema: z.preprocess(
                    (arg) => (typeof arg === "object" && arg !== null ? arg : {}), // convert undefined/null to {}
                    z.union(
                        [
                            z.object({
                                id: z.string(),
                                userId: z.string().optional(),
                                search: z.string().optional(),
                            }),
                            z.object({
                                id: z.string().optional(),
                                userId: z.string(),
                                search: z.string().optional(),
                            }),
                            z.object({
                                id: z.string().optional(),
                                userId: z.string().optional(),
                                search: z.string(),
                            }),
                        ],
                        {
                            errorMap: () => ({
                                message: "query can only be userId, id or search",
                            }),
                        }
                    )
                ),
                async handler(_, queries) {
                    if (queries.id) {
                        const res = await videoDB.get(queries.id);
                        if (!res) throw new KnownError(404, "Video not found");
                        return res;
                    }

                    if (queries.userId) {
                        return videoDB.getByUserId(queries.userId);
                    }

                    if (queries.search) {
                        return videoIndex.searchVideo(queries.search);
                    }
                },
            })(...params);

        default:
            break;
    }
};