import { OpenSearchClient } from "./openSearch-client";

export class OpenSearchIndex {
    constructor(private indexName: string, private client: OpenSearchClient) {}

    put({ doc, id }: { doc: any; id: string }) {
        console.log("OpenSearchIndexPut", this.indexName, doc);
        return this.client.index({
            id,
            body: doc,
            index: this.indexName,
            refresh: true,
        });
    }

    async search(keyword: string, fields: string[]) {
        const res = await this.client.search({
            index: this.indexName,
            body: {
                query: {
                    multi_match: {
                        query: keyword,
                        fields: fields,
                    },
                },
            },
        });

        return res.body.hits.hits.map((v: any) => ({
            id: v._id,
            ...v._source,
        }));
    }
}