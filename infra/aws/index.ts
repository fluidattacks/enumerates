import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as pulumi from "@pulumi/pulumi";
import type { APIGatewayProxyEvent } from "aws-lambda";
import type { DocumentClient } from "aws-sdk/lib/dynamodb/document_client";
import type { Table } from "@pulumi/aws/dynamodb";

interface HTMLAttribute {
  name: string;
  value: string;
}

interface Location {
  hash: string;
  host: string;
  path: string;
}

interface DBToEInputs {
  cookies: Record<string, string>[];
  forms: Record<string, string>[];
}

interface RequestToEInputs {
  cookies: string[];
  forms: HTMLAttribute[][];
}

interface RequestBody {
  inputs: RequestToEInputs;
  location: Location;
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

const s3Bucket = new aws.s3.BucketV2("fluid-enumerates", {
  forceDestroy: true,
});
const s3CORSConfiguration = new aws.s3.BucketCorsConfigurationV2( // eslint-disable-line @typescript-eslint/no-unused-vars
  "fluid-enumerates",
  {
    bucket: s3Bucket.id,
    corsRules: [
      {
        allowedMethods: ["GET"],
        allowedOrigins: ["*"],
      },
    ],
  }
);
const s3BucketPublicAccess = new aws.s3.BucketPublicAccessBlock( // eslint-disable-line @typescript-eslint/no-unused-vars
  "fluid-enumerates",
  {
    bucket: s3Bucket.id,
    blockPublicAcls: true,
    blockPublicPolicy: false,
    ignorePublicAcls: true,
    restrictPublicBuckets: false,
  }
);
const s3SSEConfiguration = new aws.s3.BucketServerSideEncryptionConfigurationV2( // eslint-disable-line @typescript-eslint/no-unused-vars
  "fluid-enumerates",
  {
    bucket: s3Bucket.id,
    rules: [
      {
        applyServerSideEncryptionByDefault: {
          sseAlgorithm: "AES256",
        },
        bucketKeyEnabled: true,
      },
    ],
  }
);
const s3PublicAccessDoc = aws.iam.getPolicyDocumentOutput({
  statements: [
    {
      sid: "PublicRead",
      actions: ["s3:GetObject"],
      principals: [
        {
          identifiers: ["*"],
          type: "*",
        },
      ],
      resources: [pulumi.interpolate`${s3Bucket.arn}/*`],
    },
  ],
});
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const s3BucketPolicy = new aws.s3.BucketPolicy("public-read", {
  bucket: s3Bucket.id,
  policy: s3PublicAccessDoc.apply((document) => document.json),
});

const dynamoTable: Table = new aws.dynamodb.Table("toe-enumerator", {
  attributes: [
    {
      name: "hk",
      type: "S",
    },
    {
      name: "rk",
      type: "S",
    },
    {
      name: "host",
      type: "S",
    },
  ],
  billingMode: "PROVISIONED",
  globalSecondaryIndexes: [
    {
      hashKey: "hk",
      name: "gsi-main",
      projectionType: "ALL",
      rangeKey: "rk",
      readCapacity: 10,
      writeCapacity: 10,
    },
    {
      hashKey: "rk",
      name: "gsi-inverted",
      projectionType: "ALL",
      rangeKey: "hk",
      readCapacity: 10,
      writeCapacity: 10,
    },
    {
      hashKey: "host",
      name: "gsi-host",
      projectionType: "ALL",
      rangeKey: "hk",
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
  location: Location
): Promise<DBToEInputs> => {
  const tableName = dynamoTable.name.get();
  const formInputs = await dynamoClient
    .query({
      TableName: tableName,
      IndexName: "gsi-main",
      KeyConditionExpression: "hk = :hk and begins_with(rk, :rk)",
      ExpressionAttributeValues: {
        ":hk": `HOST#${location.host}#PATH#${location.path}#HASH#${location.path}`,
        ":rk": "XPATH",
      },
    })
    .promise()
    .then((queryResult) => queryResult.$response);

  const cookieInputs = await dynamoClient
    .query({
      TableName: tableName,
      IndexName: "gsi-main",
      KeyConditionExpression: "hk = :hk and begins_with(rk, :rk)",
      ExpressionAttributeValues: {
        ":hk": `HOST#${location.host}`,
        ":rk": "COOKIE",
      },
    })
    .promise()
    .then((queryResult) => queryResult.$response);

  return {
    cookies:
      cookieInputs.data && cookieInputs.data.Items
        ? cookieInputs.data.Items
        : [],
    forms:
      formInputs.data && formInputs.data.Items ? formInputs.data.Items : [],
  };
};

const processInputs = (
  inputs: RequestToEInputs,
  existingInputs: DBToEInputs,
  location: Location
): InputsToWrite => {
  const writeRequests: DocumentClient.WriteRequests = [];
  let newInputs = 0;

  let inputType: keyof typeof existingInputs;
  for (inputType in existingInputs) {
    const inputsInDb: string[] = existingInputs[inputType].map(
      (item: Record<string, string>): string => item["rk"].split("#")[1]
    );

    inputs[inputType].forEach((input: string | HTMLAttribute[]) => {
      const item: Record<string, string> = {};
      let identifier: string;

      if (typeof input === "string") {
        item["hk"] = `HOST#${location.host}`;
        item["rk"] = `COOKIE#${input}`;

        identifier = input;
      } else {
        input.forEach((attribute: HTMLAttribute) => {
          item[attribute.name] = attribute.value;
        });

        item[
          "hk"
        ] = `HOST#${location.host}#PATH#${location.path}#HASH#${location.hash}`;
        item["rk"] = `XPATH#${item["xpath"]}`;

        identifier = item["xpath"];
      }

      item["host"] = `HOST#${location.host}`;
      item["first_seen"] = item["last_seen"] = new Date().toISOString();
      if (inputsInDb.indexOf(identifier) > -1) {
        item["first_seen"] =
          existingInputs[inputType][inputsInDb.indexOf(identifier)][
            "first_seen"
          ];
      } else {
        newInputs++;
      }

      writeRequests.push({
        PutRequest: {
          Item: item,
        },
      });
    });
  }

  return { inputs: writeRequests, newInputs };
};

const lambdaFn = new aws.lambda.CallbackFunction("enumerator-fn", {
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

          const { inputs, location } = JSON.parse(body) as RequestBody;
          // # is used as a delimiter in the DB, so replace it in the hash
          location.hash = location.hash.replace("#", "{anchor}");

          if (!dynamoClient) {
            dynamoClient = new aws.sdk.DynamoDB.DocumentClient();
          }

          const existingInputs = await fetchExistingInputs(
            dynamoClient,
            location
          );
          const parsedInputs = processInputs(inputs, existingInputs, location);

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

const restApi = new awsx.classic.apigateway.API("enumerator-api", {
  routes: [
    { path: "/", method: "OPTIONS", eventHandler: lambdaFn },
    { path: "/", method: "POST", eventHandler: lambdaFn },
  ],
});

// The URL at which the REST API will be served.
export const { url } = restApi,
  s3BucketName = s3Bucket.id;
