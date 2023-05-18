import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as pulumi from "@pulumi/pulumi"; // eslint-disable-line @typescript-eslint/no-unused-vars
import * as CryptoJS from "crypto-js";
import type { APIGatewayProxyEvent } from "aws-lambda";
import type { DocumentClient } from "aws-sdk/lib/dynamodb/document_client";
import type { Table } from "@pulumi/aws/dynamodb";

interface HTMLAttribute {
  name: string;
  value: string;
}

interface Payload {
  host: string;
  inputs: HTMLAttribute[][];
  path: string;
}

interface LambdaResponse {
  statusCode: number;
  headers?: Record<string, string>;
}

const dynamoTable: Table = new aws.dynamodb.Table("toe_enumerator", {
    attributes: [
      {
        name: "hk",
        type: "S",
      },
      {
        name: "rk",
        type: "S",
      },
    ],
    billingMode: "PROVISIONED",
    globalSecondaryIndexes: [
      {
        hashKey: "hk",
        name: "gsi-1",
        projectionType: "ALL",
        rangeKey: "rk",
        readCapacity: 10,
        writeCapacity: 10,
      },
    ],
    hashKey: "hk",
    rangeKey: "rk",
    readCapacity: 20,
    writeCapacity: 20,
  }),
  // A Lambda function to invoke
  lambdaFn = new aws.lambda.CallbackFunction("enumerator_fn", {
    callback: async (event: APIGatewayProxyEvent) => {
      let response: LambdaResponse;

      if (event.httpMethod.toLowerCase() === "options") {
        response = {
          headers: {
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "OPTIONS,POST",
          },
          statusCode: 200,
        };
      } else {
        let { body } = event;

        if (body !== null) {
          if (event.isBase64Encoded) {
            body = Buffer.from(body, "base64").toString("binary");
          }

          const parsedBody = JSON.parse(body) as Payload,
            { host, inputs, path } = parsedBody,
            writeRequests: DocumentClient.WriteRequests = [];

          inputs.forEach((input: HTMLAttribute[]) => {
            const item: Record<string, string> = {};

            input.forEach((attribute: HTMLAttribute) => {
              item[attribute.name] = attribute.value;
            });

            const identifier: string =
              item["name"] ||
              item["id"] ||
              item["placeholder"] ||
              CryptoJS.SHA256(JSON.stringify(input)).toString(CryptoJS.enc.Hex);

            item["hk"] = `HOST#${host}#PATH#${path}`;
            item["rk"] = `TAG#${item["tagname"]}#IDENTIFIER#${identifier}`;
            writeRequests.push({
              PutRequest: {
                Item: item,
              },
            });
          });

          const dynamoClient = new aws.sdk.DynamoDB.DocumentClient();
          await dynamoClient
            .batchWrite({
              RequestItems: {
                [dynamoTable.name.get()]: writeRequests,
              },
            })
            .promise();
        }

        response = {
          headers: { "Access-Control-Allow-Origin": "*" },
          statusCode: 200,
        };
      }

      return response;
    },
  }),
  // A REST API to route requests to HTML content and the Lambda function
  restApi = new awsx.classic.apigateway.API("enumerator_api", {
    routes: [
      { path: "/", method: "OPTIONS", eventHandler: lambdaFn },
      { path: "/", method: "POST", eventHandler: lambdaFn },
    ],
  });

// The URL at which the REST API will be served.
export const { url } = restApi;
