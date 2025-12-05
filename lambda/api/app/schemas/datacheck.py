from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime


class FileInfo(BaseModel):
    """ファイル情報"""
    type: str  # datacheck_work_order, datacheck_invoice, datacheck_export_declaration
    filename: str
    content_type: str


class ProjectInitRequest(BaseModel):
    """プロジェクト初期化リクエスト"""
    name: Optional[str] = None
    files: List[FileInfo]


class DocumentInfo(BaseModel):
    """ドキュメント情報"""
    document_id: str
    document_type: str
    presigned_url: str
    s3_key: str


class ProjectInitResponse(BaseModel):
    """プロジェクト初期化レスポンス"""
    project_id: str
    documents: List[DocumentInfo]


class ProjectCreateRequest(BaseModel):
    """プロジェクト作成リクエスト"""
    name: Optional[str] = None


class ProjectCreateResponse(BaseModel):
    """プロジェクト作成レスポンス"""
    project_id: str
    created_at: str


class DocumentUploadRequest(BaseModel):
    """帳票アップロードリクエスト"""
    filename: str
    content_type: str
    document_type: str  # work_order, invoice, export_declaration


class FeedbackRequest(BaseModel):
    """フィードバックリクエスト"""
    feedback_type: str  # "good" or "bad"
    doc1_name: str
    doc2_name: str
    doc1_id: str
    doc2_id: str
    field1_name: str
    field1_display: str
    field2_name: str
    field2_display: str
    value1: str
    value2: str
    status: str
    reason: str


class DocumentUploadResponse(BaseModel):
    """帳票アップロードレスポンス"""
    presigned_url: str
    document_id: str
    s3_key: str


class DocumentUploadCompleteRequest(BaseModel):
    """帳票アップロード完了リクエスト"""
    document_id: str
    filename: str


class CheckExecuteRequest(BaseModel):
    """データチェック実行リクエスト"""
    pass


class ComparisonItem(BaseModel):
    """比較項目の詳細"""
    field1_name: str
    field2_name: str
    field1_display: str
    field2_display: str
    value1: str
    value2: str
    status: str  # "match" or "mismatch"
    reason: str  # LLMが判断した理由


class CheckResult(BaseModel):
    """チェック結果"""
    comparison_type: str  # work_order_vs_invoice, work_order_vs_export, invoice_vs_export
    doc1_name: str
    doc2_name: str
    total_items: int
    matched_items: int
    match_rate: int
    items: List[ComparisonItem]


class CheckExecuteResponse(BaseModel):
    """データチェック実行レスポンス"""
    project_id: str
    status: str
    results: Optional[List[CheckResult]] = None


class ProjectResponse(BaseModel):
    """プロジェクト情報レスポンス"""
    project_id: str
    name: Optional[str]
    status: str
    created_at: str
    documents: List[Dict[str, Any]]
    check_result: Optional[List[Dict[str, Any]]] = None
