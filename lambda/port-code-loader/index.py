"""Lambda function to load port codes to DynamoDB on CDK deployment."""
import json
import boto3
import os
import csv

s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")

MASTER_DATA_BUCKET = os.environ.get("MASTER_DATA_BUCKET_NAME")
PORT_CODES_TABLE = os.environ.get("PORT_CODES_TABLE_NAME")


def handler(event, context):
    """CDK Custom Resource handler"""
    request_type = event.get("RequestType")
    
    if request_type == "Create":
        try:
            load_port_codes()
            return send_response(event, context, "SUCCESS", {"Message": "Port codes loaded"})
        except Exception as e:
            print(f"Error: {str(e)}")
            import traceback
            traceback.print_exc()
            return send_response(event, context, "FAILED", {"Message": str(e)})
    
    # Update/Deleteは何もしない
    return send_response(event, context, "SUCCESS", {"Message": "No action needed"})


def load_port_codes():
    """Load port codes from S3 CSV to DynamoDB"""
    # S3からCSVを読み込み
    response = s3.get_object(Bucket=MASTER_DATA_BUCKET, Key="data/port_codes.csv")
    csv_content = response['Body'].read().decode('utf-8')
    
    table = dynamodb.Table(PORT_CODES_TABLE)
    
    # CSVをパース
    csv_reader = csv.DictReader(csv_content.splitlines())
    count = 0
    
    with table.batch_writer() as batch:
        for row in csv_reader:
            item = {
                "port_code": row["port_code"],
                "port_name": row["port_name"],
                "country": row["country"],
            }
            batch.put_item(Item=item)
            count += 1
    
    print(f"Loaded {count} port codes")


def send_response(event, context, status, data):
    """Send response to CloudFormation"""
    import urllib3
    http = urllib3.PoolManager()
    
    response_body = {
        "Status": status,
        "PhysicalResourceId": context.log_stream_name,
        "StackId": event["StackId"],
        "RequestId": event["RequestId"],
        "LogicalResourceId": event["LogicalResourceId"],
        "Data": data,
    }
    
    response_url = event.get("ResponseURL")
    if response_url:
        http.request("PUT", response_url, body=json.dumps(response_body))
    
    return response_body
