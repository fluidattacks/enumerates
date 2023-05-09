import * as apigateway from "@pulumi/aws-apigateway";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import type {APIGatewayProxyEvent} from "aws-lambda";
import type {DocumentClient} from "aws-sdk/lib/dynamodb/document_client";
import type {Table} from "@pulumi/aws/dynamodb";


interface ToEInput {
    identifier: string;
    tag: "input" | "textarea";
    type: string;
}


const dynamoTable: Table = new aws.dynamodb.Table(
        "toe_enumerator",
        {
            "attributes": [
                {
                    "name": "hk",
                    "type": "S"
                },
                {
                    "name": "rk",
                    "type": "S"
                }
            ],
            "billingMode": "PROVISIONED",
            "globalSecondaryIndexes": [
                {
                    "hashKey": "hk",
                    "name": "gsi-1",
                    "nonKeyAttributes": [
                        "host",
                        "identifier",
                        "path",
                        "tag",
                        "type"
                    ],
                    "projectionType": "INCLUDE",
                    "rangeKey": "rk",
                    "readCapacity": 10,
                    "writeCapacity": 10
                }
            ],
            "hashKey": "hk",
            "rangeKey": "rk",
            "readCapacity": 20,
            "writeCapacity": 20
        }
    ),

    // A Lambda function to invoke
    lambdaFn = new aws.lambda.CallbackFunction(
        "enumerator_fn",
        {
            "callback": async (event: APIGatewayProxyEvent) => {

                const {body = "{}"} = event,
                    parsedBody = JSON.parse(body || "{}"),
                    {host, inputs, path} = parsedBody,
                    writeRequests: DocumentClient.WriteRequests = [];

                inputs.forEach((input: ToEInput) => {

                    const item = {
                        "hk": `HOST#${host}#PATH#${path}`,
                        host,
                        "identifier": input.identifier,
                        path,
                        "rk": `TAG#${input.tag}#TYPE#${input.type}#IDENTIFIER#${input.identifier}`,
                        "type": input.type
                    };
                    writeRequests.push({
                        "PutRequest": {
                            "Item": item
                        }
                    });

                });

                const dynamoClient = new aws.sdk.DynamoDB.DocumentClient();
                await dynamoClient.batchWrite({
                    "RequestItems": {
                        [dynamoTable.name.get()]: writeRequests
                    }
                }).promise();

                return {"statusCode": 200};

            }
        }
    ),

    // A REST API to route requests to HTML content and the Lambda function
    restApi: apigateway.RestAPI = new apigateway.RestAPI(
        "enumerator_api",
        {
            "routes": [
                {"path": "/",
                    "method": "POST",
                    "eventHandler": lambdaFn}
            ]
        }
    );

// The URL at which the REST API will be served.
export const {url} = restApi;
