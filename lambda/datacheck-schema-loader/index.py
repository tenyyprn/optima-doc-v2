"""Lambda function to load datacheck schemas to DynamoDB on CDK deployment."""
import json
import boto3
import os
from datetime import datetime

s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")

MASTER_DATA_BUCKET = os.environ.get("MASTER_DATA_BUCKET_NAME")
SCHEMAS_TABLE = os.environ.get("SCHEMAS_TABLE_NAME")


def handler(event, context):
    """CDK Custom Resource handler"""
    request_type = event.get("RequestType")
    
    if request_type == "Create":
        try:
            load_datacheck_schemas()
            return send_response(event, context, "SUCCESS", {"Message": "Datacheck schemas loaded"})
        except Exception as e:
            print(f"Error: {str(e)}")
            import traceback
            traceback.print_exc()
            return send_response(event, context, "FAILED", {"Message": str(e)})
    
    # Update/Deleteは何もしない
    return send_response(event, context, "SUCCESS", {"Message": "No action needed"})


def load_datacheck_schemas():
    """Load datacheck schemas from S3 to DynamoDB"""
    schemas = [
        {
            "s3_key": "schemas/datacheck_work_order.json",
            "name": "datacheck_work_order",
            "display_name": "作業依頼書(輸出)",
            "description": "輸出作業依頼書の情報抽出"
        },
        {
            "s3_key": "schemas/datacheck_invoice.json",
            "name": "datacheck_invoice",
            "display_name": "INVOICE",
            "description": "INVOICEの情報抽出"
        },
        {
            "s3_key": "schemas/datacheck_export_declaration.json",
            "name": "datacheck_export_declaration",
            "display_name": "輸出申告事項登録",
            "description": "輸出申告事項登録の情報抽出"
        }
    ]
    
    table = dynamodb.Table(SCHEMAS_TABLE)
    
    for schema_info in schemas:
        # S3からスキーマJSONを読み込み
        response = s3.get_object(Bucket=MASTER_DATA_BUCKET, Key=schema_info["s3_key"])
        schema_json = response['Body'].read().decode('utf-8')
        fields = json.loads(schema_json)
        
        # スキーマを登録
        item = {
            "schema_type": "app",
            "name": schema_info["name"],
            "display_name": schema_info["display_name"],
            "description": schema_info["description"],
            "fields": fields,
            "input_methods": {
                "file_upload": True,
                "s3_sync": False
            },
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        table.put_item(Item=item)
        print(f"Loaded {schema_info['name']} schema with {len(fields)} fields")


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
