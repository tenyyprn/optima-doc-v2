from fastapi import APIRouter, HTTPException
import logging
from schemas.datacheck import *
from services.datacheck_service import DataCheckService

logger = logging.getLogger(__name__)
router = APIRouter(tags=["DataCheck"])

datacheck_service = DataCheckService()


def set_background_task(background_task):
    """main.pyからバックグラウンドタスクを設定する"""
    global datacheck_service
    datacheck_service = DataCheckService(background_task)


@router.get("/projects")
async def list_projects():
    """プロジェクト一覧を取得"""
    try:
        return await datacheck_service.list_projects()
    except Exception as e:
        logger.error(f"Error listing projects: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/init", response_model=ProjectInitResponse)
async def init_project(request: ProjectInitRequest):
    """プロジェクト初期化（3ファイル情報を送りpresigned URL取得）"""
    try:
        return await datacheck_service.init_project(request)
    except Exception as e:
        logger.error(f"Error initializing project: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/upload-complete")
async def upload_complete(project_id: str):
    """アップロード完了通知"""
    try:
        return await datacheck_service.upload_complete(project_id)
    except Exception as e:
        logger.error(f"Error handling upload complete: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str):
    """プロジェクト詳細を取得"""
    try:
        return await datacheck_service.get_project(project_id)
    except Exception as e:
        logger.error(f"Error getting project: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/ocr/start")
async def start_ocr(project_id: str):
    """OCR実行"""
    try:
        return await datacheck_service.execute_ocr(project_id)
    except Exception as e:
        logger.error(f"Error starting OCR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/documents/{document_id}/confirm")
async def confirm_ocr(project_id: str, document_id: str):
    """OCR確認完了"""
    try:
        return await datacheck_service.confirm_ocr(project_id, document_id)
    except Exception as e:
        logger.error(f"Error confirming OCR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/check/start", response_model=CheckExecuteResponse)
async def start_check(project_id: str):
    """データチェック実行"""
    try:
        return await datacheck_service.execute_check(project_id)
    except Exception as e:
        logger.error(f"Error starting check: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/check/result")
async def get_check_result(project_id: str):
    """チェック結果取得"""
    try:
        project = await datacheck_service.get_project(project_id)
        return {
            "project_id": project.project_id,
            "status": project.status,
            "results": project.check_result
        }
    except Exception as e:
        logger.error(f"Error getting check result: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/feedback")
async def save_feedback(project_id: str, request: FeedbackRequest):
    """フィードバックを保存"""
    try:
        return await datacheck_service.save_feedback(project_id, request)
    except Exception as e:
        logger.error(f"Error saving feedback: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/recommend")
async def get_recommend_data(project_id: str):
    """レコメンド用のデータを取得"""
    try:
        return await datacheck_service.get_recommend_data(project_id)
    except ValueError as e:
        logger.error(f"Project not found: {str(e)}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting recommend data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/projects/{project_id}/dock-receipt")
async def save_dock_receipt(project_id: str, request: dict):
    """ドックレシートデータを保存"""
    try:
        fields = request.get("fields", [])
        return await datacheck_service.save_dock_receipt(project_id, fields)
    except Exception as e:
        logger.error(f"Error saving dock receipt: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

