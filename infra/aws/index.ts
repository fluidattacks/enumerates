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
  headers: Record<string, string>;
  statusCode: number;
  body?: string;
}

interface InputsToWrite {
  inputs: DocumentClient.WriteRequests;
  newInputs: number;
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
});

const fetchExistingInputs = async (
  dynamoClient: DocumentClient,
  host: string,
  path: string
): Promise<Record<string, string>[]> => {
  const hk = `HOST#${host}#PATH#${path}`;

  const response = await dynamoClient
    .query({
      TableName: dynamoTable.name.get(),
      IndexName: "gsi-1",
      KeyConditionExpression: "hk = :hk and begins_with(rk, :rk)",
      ExpressionAttributeValues: { ":hk": hk, ":rk": "TAG" },
    })
    .promise()
    .then((queryResult) => queryResult.$response);

  return response.data && response.data.Items ? response.data.Items : [];
};

const processInputs = (
  inputs: HTMLAttribute[][],
  existingInputs: Record<string, string>[],
  host: string,
  path: string
): InputsToWrite => {
  const existingIdentifiersInDb: string[] = existingInputs.map(
      (input: Record<string, string>): string => {
        const splitRk = input["rk"].split("#");

        return input["duplicate_index"] === undefined ? splitRk[3] : splitRk[5];
      }
    ),
    duplicateIdentifiers: Record<string, number> = {},
    writeRequests: DocumentClient.WriteRequests = [];

  let newInputs = 0;

  inputs.forEach((input: HTMLAttribute[]) => {
    const item: Record<string, string> = {};

    input.forEach((attribute: HTMLAttribute) => {
      item[attribute.name] = attribute.value;
    });

    const identifier: string =
      item["id"] || item["name"] || item["placeholder"] || "undefined";

    if (duplicateIdentifiers[identifier] === undefined) {
      duplicateIdentifiers[identifier] = 0;
    } else {
      item["duplicate_index"] = duplicateIdentifiers[identifier].toString();
      duplicateIdentifiers[identifier]++;
    }

    const hash = CryptoJS.SHA256(JSON.stringify(item)).toString(
        CryptoJS.enc.Hex
      ),
      inputExistsInDb: boolean =
        item["duplicate_index"] === undefined
          ? existingIdentifiersInDb.indexOf(identifier) > -1
          : existingIdentifiersInDb.indexOf(hash) > -1;

    item["hk"] = `HOST#${host}#PATH#${path}`;
    item["rk"] = `TAG#${item["tagname"]}#IDENTIFIER#${identifier}#HASH#${hash}`;
    item["first_seen"] = item["last_seen"] = new Date().toISOString();

    if (inputExistsInDb) {
      writeRequests.push({
        PutRequest: {
          Item:
            item["duplicate_index"] === undefined
              ? {
                  ...existingInputs[
                    existingIdentifiersInDb.indexOf(identifier)
                  ],
                  last_seen: item["last_seen"],
                }
              : {
                  ...existingInputs[existingIdentifiersInDb.indexOf(hash)],
                  last_seen: item["last_seen"],
                },
        },
      });
    } else {
      newInputs++;
      writeRequests.push({
        PutRequest: {
          Item: item,
        },
      });
    }
  });

  return { inputs: writeRequests, newInputs };
};

const lambdaFn = new aws.lambda.CallbackFunction("enumerator_fn", {
  callbackFactory: () => {
    let dynamoClient = new aws.sdk.DynamoDB.DocumentClient();

    return async (event: APIGatewayProxyEvent) => {
      let response: LambdaResponse = {
        headers: { "Access-Control-Allow-Origin": "*" },
        statusCode: 200,
      };

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
            { host, inputs, path } = parsedBody;

          if (!dynamoClient) {
            dynamoClient = new aws.sdk.DynamoDB.DocumentClient();
          }

          const existingInputs = await fetchExistingInputs(
              dynamoClient,
              host,
              path
            ),
            parsedInputs = processInputs(inputs, existingInputs, host, path);

          if (parsedInputs.inputs.length > 0) {
            await dynamoClient
              .batchWrite({
                RequestItems: {
                  [dynamoTable.name.get()]: parsedInputs.inputs,
                },
              })
              .promise()
              .then(() => {
                response = {
                  body: JSON.stringify({
                    message: `${parsedInputs.newInputs} new inputs were found`,
                  }),
                  headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json",
                  },
                  statusCode: 200,
                };
              });
          }
        }
      }

      return response;
    };
  },
});

const restApi = new awsx.classic.apigateway.API("enumerator_api", {
  routes: [
    { path: "/", method: "OPTIONS", eventHandler: lambdaFn },
    { path: "/", method: "POST", eventHandler: lambdaFn },
  ],
});

// The URL at which the REST API will be served.
export const { url } = restApi;
