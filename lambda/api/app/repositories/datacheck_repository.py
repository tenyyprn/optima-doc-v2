from clients import dynamodb_resource
import logging
from datetime import datetime
import uuid
from config import settings

logger = logging.getLogger(__name__)


def get_projects_table():
    """プロジェクトテーブルを取得"""
    table_name = settings.DATACHECK_PROJECTS_TABLE_NAME
    return dynamodb_resource.Table(table_name)


def create_project(name=None, project_id=None):
    """プロジェクトを作成"""
    table = get_projects_table()
    if not project_id:
        project_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().isoformat()
    
    item = {
        "project_id": project_id,
        "name": name or f"Project {project_id[:8]}",
        "status": "pending",
        "created_at": timestamp,
        "updated_at": timestamp
    }
    
    table.put_item(Item=item)
    logger.info(f"Created project: {project_id}")
    return item


def get_project(project_id):
    """プロジェクトを取得"""
    table = get_projects_table()
    response = table.get_item(Key={"project_id": project_id})
    return response.get("Item")


def update_project_dock_receipt(project_id, dock_receipt_data):
    """プロジェクトのドックレシートデータを更新"""
    table = get_projects_table()
    timestamp = datetime.utcnow().isoformat()
    
    table.update_item(
        Key={"project_id": project_id},
        UpdateExpression="SET dock_receipt_data = :data, updated_at = :timestamp",
        ExpressionAttributeValues={
            ":data": dock_receipt_data,
            ":timestamp": timestamp
        }
    )
    logger.info(f"Updated dock receipt data for project: {project_id}")


def list_projects():
    """プロジェクト一覧を取得"""
    table = get_projects_table()
    response = table.scan()
    items = response.get("Items", [])
    
    # 作成日時の降順でソート
    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    return items


def update_project_status(project_id, status):
    """プロジェクトステータスを更新"""
    table = get_projects_table()
    timestamp = datetime.utcnow().isoformat()
    
    table.update_item(
        Key={"project_id": project_id},
        UpdateExpression="SET #status = :status, updated_at = :updated_at",
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={
            ":status": status,
            ":updated_at": timestamp
        }
    )
    logger.info(f"Updated project {project_id} status to {status}")


def update_project_job_id(project_id, job_id):
    """プロジェクトにOCRジョブIDを紐付け"""
    table = get_projects_table()
    timestamp = datetime.utcnow().isoformat()
    
    table.update_item(
        Key={"project_id": project_id},
        UpdateExpression="SET job_id = :job_id, updated_at = :updated_at",
        ExpressionAttributeValues={
            ":job_id": job_id,
            ":updated_at": timestamp
        }
    )
    logger.info(f"Updated project {project_id} with job_id {job_id}")


def update_project_check_result(project_id, results):
    """チェック結果を保存"""
    table = get_projects_table()
    timestamp = datetime.utcnow().isoformat()
    
    table.update_item(
        Key={"project_id": project_id},
        UpdateExpression="SET check_results = :results, #status = :status, updated_at = :updated_at",
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={
            ":results": results,
            ":status": "completed",
            ":updated_at": timestamp
        }
    )
    logger.info(f"Saved check results for project {project_id}")



def get_feedback_table():
    """フィードバックテーブルを取得"""
    table_name = settings.FEEDBACK_TABLE_NAME
    return dynamodb_resource.Table(table_name)


def save_feedback(feedback_data):
    """フィードバックをDynamoDBに保存"""
    table = get_feedback_table()
    table.put_item(Item=feedback_data)
    logger.info(f"Saved feedback {feedback_data['feedback_id']}")
