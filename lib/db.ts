import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {DynamoDBDocumentClient, PutCommand, UpdateCommand, GetCommand, QueryCommand} from "@aws-sdk/lib-dynamodb";

export class DB<T extends {id: string}> {

    private client: DynamoDBClient;

    constructor(private config: {tableName: string, region: string}) {
        this.client = DynamoDBDocumentClient.from(new DynamoDBClient({
            region: this.config.region
        }), {
            marshallOptions: {
                removeUndefinedValues: true,
            }
        })
    }

    async save(doc: T) {
        return  this.client.send(new PutCommand({
            TableName: this.config.tableName,
            Item: doc
        }));
    }

    async update({id, attrs}:{ id: string, attrs: Partial<Omit<T, "id">>}) {

        const UpdateExpressionArr: string[] = [];
        const ExpressionAttributeNames: Record<string, any> = {};
        const ExpressionAttributeValues: Record<string, any> = {};

        (Object.keys(attrs) as Array<keyof typeof attrs>).forEach(key => {
            ExpressionAttributeNames[`#${String(key)}`] = key;
            ExpressionAttributeValues[`:${String(key)}`] = attrs[key];
            UpdateExpressionArr.push(`#${String(key)} = :${String(key)}`);
        })

        return this.client.send(new UpdateCommand({
           TableName: this.config.tableName,
           Key: {
               id: id
           },
           UpdateExpression: `set ${UpdateExpressionArr.join(', ')}`,
           ExpressionAttributeNames,
           ExpressionAttributeValues
       }));
    }

    async get(id: string) {
        const res = await this.client.send(
            new GetCommand({
                TableName: this.config.tableName,
                Key: {
                    id,
                },
            })
        );

        return res.Item as T;
    }

    async queryGSI({
                       IndexName,
                       KeyConditionExpression,
                       ExpressionAttributeNames,
                       ExpressionAttributeValues,
                   }: {
        IndexName: string;
        KeyConditionExpression: string;
        ExpressionAttributeNames: Record<string, string>;
        ExpressionAttributeValues: Record<string, string>;
    }): Promise<T[]> {
        const res = await this.client.send(
            new QueryCommand({
                TableName: this.config.tableName,
                IndexName,
                KeyConditionExpression,
                ExpressionAttributeNames,
                ExpressionAttributeValues,
            })
        );

        return res.Items as T[];
    }
}

