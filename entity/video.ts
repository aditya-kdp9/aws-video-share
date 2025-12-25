import { z } from "zod";
import {DB} from "../lib/db";
import {OpenSearchIndex} from "../lib/openSearch-index";
import {OpenSearchClient} from "../lib/openSearch-client";


export const docSchema = z.object({
    id: z.string(),
    userId: z.string(),
    title: z.string(),
    description: z.string().optional(),
    uploadedTime: z.number(),
    tags: z.array(z.string()).optional(),
    // @ts-ignore
    status: z.enum(["NOT_UPLOADED", "UPLOADED", "PROCESSING", "READY", "ERROR"]),
    files: z
        .object({
            "720p": z.string().optional(),
            "360p": z.string().optional(),
            "240p": z.string().optional(),
        })
        .optional(),
});
type PartialAttrs = Partial<Omit<z.infer<typeof docSchema>, "id">>;

export class VideoDB extends DB<z.infer<typeof docSchema>> {
    changes: PartialAttrs = {};
    collectChanges(attrs: PartialAttrs) {
        this.changes = {
            ...this.changes,
            ...attrs,
        };
    }

    getByUserId(userId: string) {
        return this.queryGSI({
            IndexName: "byUserId",
            KeyConditionExpression: "#userId = :userId",
            ExpressionAttributeNames: {
                "#userId": "userId",
            },
            ExpressionAttributeValues: {
                ":userId": userId,
            },
        });
    }

    addFiles(files: PartialAttrs["files"]) {
        this.changes.files = {
            ...this.changes.files,
            ...files,
        };
    }
}

export class VideoIndex extends OpenSearchIndex {

    constructor(client: OpenSearchClient) {
        super("video", client);
    }

    putVideo(doc: z.infer<typeof docSchema>) {
        console.log("mediaConverter", doc);
        return this.put({
            id: doc.id,
            doc: {
                title: doc.title,
                description: doc.description,
                tags: doc.tags,
            },
        });
    }

    searchVideo(keyword: string) {
     // @ts-ignore
        return this.search(keyword,["title", "description", "tags"]) as Promise<
        {
        id: string;
        title: string;
        description: string;
        tags: string[];
        }>;
    }

}

