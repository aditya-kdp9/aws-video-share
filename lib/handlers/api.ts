import {z, ZodError, ZodSchema} from "zod";
import {APIGatewayEvent, APIGatewayProxyHandler} from "aws-lambda";
import {KnownError} from "../error";

export const withValidation = <TBody extends ZodSchema,
TQuery extends ZodSchema>({
    handler,
    bodySchema,
    querySchema,
}: {
    bodySchema?: TBody;
    querySchema?: TQuery;
    handler: (
        body: z.infer<TBody>,
        queries: z.infer<TQuery>,
        e: APIGatewayEvent
    ) => Promise<any>;
}) => {
    const apiGateWayProxyHandler: APIGatewayProxyHandler = async (e: APIGatewayEvent) => {
        try {
            let body = {};
            let queries = {};

            if (bodySchema) {
                // @ts-ignore
                body = bodySchema.parse(JSON.parse(e.body || "{}"));
            }
            if (querySchema) {
                // @ts-ignore
                queries = querySchema.parse(e.queryStringParameters || {});
            }

            // @ts-ignore
            const res = await handler(body, queries, e);
            return {
                body: JSON.stringify(res),
                statusCode: 200,
            };
        } catch (error) {
            // zodError
            // if (error instanceof ZodError) {
            //     return {
            //         statusCode: 400,
            //         // @ts-ignore
            //         body: error.errors.reduce((a, c) => {
            //             a += `${c.path} - ${c.message}, `;
            //             return a;
            //         }, ""),
            //     };
            // }

            // known error
            if (error instanceof KnownError) {
                return {
                    body: error.message,
                    statusCode: error.code,
                };
            }

            // unknown error
            console.log(error);
            return {
                body: "Something went wrong",
                statusCode: 500,
            };
        }
    }

    return apiGateWayProxyHandler;
}