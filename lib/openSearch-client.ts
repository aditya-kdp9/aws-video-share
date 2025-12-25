import {Client} from "@opensearch-project/opensearch";
import  { defaultProvider }  from '@aws-sdk/credential-provider-node';
import { AwsSigv4Signer } from "@opensearch-project/opensearch/aws";

export class OpenSearchClient extends Client {

    constructor(config: {endpoint: string, region: string}) {
        super({
            ...AwsSigv4Signer({
                region: config.region,
                service: 'es',
                // Must return a Promise that resolve to an AWS.Credentials object.
                // This function is used to acquire the credentials when the client start and
                // when the credentials are expired.
                // The Client will refresh the Credentials only when they are expired.
                // With AWS SDK V2, Credentials.refreshPromise is used when available to refresh the credentials.

                // Example with AWS SDK V2:
                getCredentials: () => {
                    const credentialsProvider = defaultProvider();
                    return credentialsProvider();
                }
            }),
            node: config.endpoint, // OpenSearch domain URL
        })
    }
}