import { CdkCustomResourceHandler } from "aws-lambda";
import {OpenSearchClient} from "../../lib/openSearch-client";

export const handler: CdkCustomResourceHandler = async (event) => {

    if (event.RequestType === "Create") {
        const client = new OpenSearchClient({
            endpoint: event.ResourceProperties.endpoint,
            region: event.ResourceProperties.region,
        });

        await client.indices.create({
            index: event.ResourceProperties.indexName,
            body: event.ResourceProperties.indexProperties,
        });
    }

    return {
        PhysicalResourceId: event.ResourceProperties.indexName
    };
};