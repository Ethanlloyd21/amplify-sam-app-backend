// const { DynamoDB } = require("aws-sdk")

// const db = new DynamoDB.DocumentClient()
// const TableName = process.env.TABLE_NAME

// exports.handler = async function (event) {
//     console.log("request:", JSON.stringify(event));
  
//     // return response back to upstream caller
//     return {
//       statusCode: 200,
//       headers: {
//         "Access-Control-Allow-Origin": "*",
//       },
//       body: JSON.stringify('HELLLLOOO'),
//     };
//   };

const AWS = require('aws-sdk');
// AWS.config.update( {
//   region: 'us-east-1'
// });
const dynamodb = new AWS.DynamoDB.DocumentClient();
const dynamodbTableName = process.env.TABLE_NAME;
const checkPath = '/check';
const carPath = '/car';
const inventoryPath = '/inventory';

exports.handler = async function(event) {
  console.log('Request event: ', event);
  let response;
  switch(true) {
    case event.httpMethod === 'GET' && event.path === checkPath:
      response = buildResponse(200);
      break;
    case event.httpMethod === 'GET' && event.path === carPath:
      response = await getProduct(event.queryStringParameters.id);
      break;
    case event.httpMethod === 'GET' && event.path === inventoryPath:
      response = await getProducts();
      break;
    case event.httpMethod === 'POST' && event.path === carPath:
      response = await saveProduct(JSON.parse(event.body));
      break;
    // case event.httpMethod === 'PATCH' && event.path === carPath:
    //   const requestBody = JSON.parse(event.body);
    //   response = await modifyProduct(requestBody.id, requestBody.updateKey, requestBody.updateValue);
    //   break;
    case event.httpMethod === 'DELETE' && event.path === carPath:
      response = await deleteProduct(JSON.parse(event.body).id);
      break;
    default:
      response = buildResponse(404, '404 Not Found');
  }
  return response;
}

async function getProduct(id) {
  const params = {
    TableName: dynamodbTableName,
    Key: {
      'id': id
    }
  }
  return await dynamodb.get(params).promise().then((response) => {
    return buildResponse(200, response.Item);
  }, (error) => {
    console.error('Get product error: ', error);
  });
}

async function getProducts() {
  const params = {
    TableName: dynamodbTableName
  }
  const allProducts = await scanDynamoRecords(params, []);
  const body = {
    inventory: allProducts
  }
  return buildResponse(200, body);
}

//Recursize function for DynamoDB scan. DynamoDB limit on return on one querey
async function scanDynamoRecords(scanParams, itemArray) {
  try {
    const dynamoData = await dynamodb.scan(scanParams).promise();
    itemArray = itemArray.concat(dynamoData.Items);
    if (dynamoData.LastEvaluatedKey) {
      scanParams.ExclusiveStartkey = dynamoData.LastEvaluatedKey;
      return await scanDynamoRecords(scanParams, itemArray);
    }
    return itemArray;
  } catch(error) {
    console.error('DynamoDB scan error: ', error);
  }
}

async function saveProduct(requestBody) {
  const params = {
    TableName: dynamodbTableName,
    Item: requestBody
  }
  return await dynamodb.put(params).promise().then(() => {
    const body = {
      Operation: 'SAVE',
      Message: 'SUCCESS',
      Item: requestBody
    }
    return buildResponse(200, body);
  }, (error) => {
    console.error('POST error: ', error);
  })
}

// async function modifyProduct(id, updateKey, updateValue) {
//   const params = {
//     TableName: dynamodbTableName,
//     Key: {
//       'id': id
//     },
//     UpdateExpression: `set ${updateKey} = :value`,
//     ExpressionAttributeValues: {
//       ':value': updateValue
//     },
//     ReturnValues: 'UPDATED_NEW'
//   }
//   return await dynamodb.update(params).promise().then((response) => {
//     const body = {
//       Operation: 'UPDATE',
//       Message: 'SUCCESS',
//       UpdatedAttributes: response
//     }
//     return buildResponse(200, body);
//   }, (error) => {
//     console.error('PATCH error: ', error);
//   })
// }

async function deleteProduct(id) {
  const params = {
    TableName: dynamodbTableName,
    Key: {
      'id': id
    },
    ReturnValues: 'ALL_OLD'
  }
  return await dynamodb.delete(params).promise().then((response) => {
    const body = {
      Operation: 'DELETE',
      Message: 'SUCCESS',
      Item: response
    }
    return buildResponse(200, body);
  }, (error) => {
    console.error('Delete error: ', error);
  })
}

function buildResponse(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Origin': '*',
      'X-Request-With': '*'
    },
    body: JSON.stringify(body)
  }
}