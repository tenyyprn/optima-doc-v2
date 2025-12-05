from clients import s3_client
import logging
import uuid
import json
import re
from repositories import datacheck_repository
from repositories.image_repository import (
    create_image_record, get_images_by_project_id, 
    update_image_status, update_image_ocr_confirmed, update_converted_image
)
from schemas.datacheck import *
from config import settings
from services.ocr_service import OcrService
from clients import AgentClient
from utils import resize_image, convert_pdf_to_image
from datetime import datetime

logger = logging.getLogger(__name__)


class DataCheckService:
    """データチェックサービス"""
    
    def __init__(self, background_task=None):
        self.bucket_name = settings.BUCKET_NAME
        self.background_task = background_task
        self.ocr_service = OcrService(background_task)
    
    async def create_project(self, name=None):
        """プロジェクトを作成"""
        project = datacheck_repository.create_project(name)
        return ProjectCreateResponse(
            project_id=project["project_id"],
            created_at=project["created_at"]
        )
    
    async def init_project(self, request: ProjectInitRequest):
        """プロジェクト初期化（3ファイル情報を受け取りpresigned URL生成）"""
        # プロジェクト作成
        project_id = str(uuid.uuid4())
        datacheck_repository.create_project(name=request.name, project_id=project_id)
        
        documents = []
        for file_info in request.files:
            document_id = str(uuid.uuid4())
            s3_key = f"uploads/{document_id}_{datetime.now().isoformat()}_{file_info.filename}"
            
            # presigned URL生成
            presigned_url = s3_client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': s3_key,
                    'ContentType': file_info.content_type
                },
                ExpiresIn=3600
            )
            
            # ImagesTableに登録 - app_nameにdocument_typeを使用
            create_image_record(
                image_id=document_id,
                filename=file_info.filename,
                s3_key=s3_key,
                app_name=file_info.type,  # document_typeをapp_nameとして使用
                status="uploading",
                project_id=project_id,
                document_type=file_info.type,
                ocr_confirmed=False
            )
            
            documents.append({
                "document_id": document_id,
                "document_type": file_info.type,
                "presigned_url": presigned_url,
                "s3_key": s3_key
            })
        
        logger.info(f"Initialized project {project_id} with {len(documents)} documents")
        return ProjectInitResponse(project_id=project_id, documents=documents)
    
    async def upload_complete(self, project_id: str):
        """アップロード完了処理 - PDF変換・画像リサイズを実行"""
        documents = get_images_by_project_id(project_id)
        
        for doc in documents:
            doc_id = doc["id"]
            s3_key = doc["s3_key"]
            filename = doc["filename"]
            
            try:
                # S3オブジェクトの存在確認とContent-Type取得
                s3_response = s3_client.head_object(
                    Bucket=self.bucket_name,
                    Key=s3_key
                )
                content_type = s3_response.get('ContentType', 'application/octet-stream')
                
                # ファイル種別を判定
                is_pdf = content_type == 'application/pdf' or filename.lower().endswith('.pdf')
                is_image = content_type.startswith('image/')
                
                if is_pdf:
                    # PDF変換処理
                    update_image_status(doc_id, "converting")
                    from main import background_task
                    background_task.add_task(convert_pdf_to_image, doc_id, s3_key)
                    logger.info(f"Started PDF conversion for document {doc_id}")
                    
                elif is_image:
                    # 画像リサイズ処理
                    s3_obj = s3_client.get_object(Bucket=self.bucket_name, Key=s3_key)
                    image_data = s3_obj['Body'].read()
                    
                    resized_image_data, was_resized, orig_size, new_size = resize_image(image_data)
                    
                    if was_resized:
                        converted_s3_key = f"converted/{datetime.now().isoformat()}_{filename}"
                        s3_client.put_object(
                            Bucket=self.bucket_name,
                            Key=converted_s3_key,
                            Body=resized_image_data,
                            ContentType=content_type
                        )
                        update_converted_image(doc_id, converted_s3_key, "pending", orig_size, new_size)
                        logger.info(f"Resized image for document {doc_id}")
                    else:
                        update_image_status(doc_id, "pending")
                        logger.info(f"No resize needed for document {doc_id}")
                else:
                    # その他のファイルはそのままpendingに
                    update_image_status(doc_id, "pending")
                    
            except Exception as e:
                logger.error(f"Error processing document {doc_id}: {str(e)}")
                update_image_status(doc_id, "failed")
        
        datacheck_repository.update_project_status(project_id, "pending")
        logger.info(f"Upload completed for project {project_id}")
        
        return {"project_id": project_id, "status": "pending"}
    
    async def execute_ocr(self, project_id: str):
        """OCR実行"""
        documents = get_images_by_project_id(project_id)
        
        if len(documents) != 3:
            raise ValueError(f"Expected 3 documents, found {len(documents)}")
        
        # 各ドキュメントのステータスをpendingに設定（まだの場合）
        for doc in documents:
            if doc.get("status") not in ["pending", "processing"]:
                update_image_status(doc["id"], "pending")
        
        # 既存のOCRサービスを利用（app_name指定なしで全pending画像を処理）
        job_id = await self.ocr_service.start_ocr_job(app_name=None)
        
        # プロジェクトにjob_idを紐付け
        datacheck_repository.update_project_job_id(project_id, job_id)
        datacheck_repository.update_project_status(project_id, "ocr_processing")
        
        logger.info(f"Started OCR for project {project_id}, job_id: {job_id}")
        return {"project_id": project_id, "job_id": job_id, "status": "ocr_processing"}
    
    async def confirm_ocr(self, project_id: str, document_id: str):
        """OCR確認完了"""
        update_image_ocr_confirmed(document_id, True)
        
        # 全てのドキュメントが確認済みかチェック
        documents = get_images_by_project_id(project_id)
        all_confirmed = all(doc.get("ocr_confirmed", False) for doc in documents)
        
        if all_confirmed:
            datacheck_repository.update_project_status(project_id, "ready_for_check")
            logger.info(f"All documents confirmed for project {project_id}")
        
        return {"id": document_id, "ocr_confirmed": True}
    
    async def execute_check(self, project_id: str):
        """データチェック実行（非同期）"""
        documents = get_images_by_project_id(project_id)
        
        # 前提条件チェック
        if len(documents) != 3:
            raise ValueError("3つのドキュメントが必要です")
        
        if not all(doc.get("status") == "completed" for doc in documents):
            raise ValueError("全てのドキュメントのOCR処理が完了している必要があります")
        
        if not all(doc.get("ocr_confirmed", False) for doc in documents):
            raise ValueError("全てのドキュメントのOCR結果を確認してください")
        
        # ステータスを更新してすぐ返す
        datacheck_repository.update_project_status(project_id, "checking")
        
        # バックグラウンドでチェック実行
        if self.background_task:
            self.background_task.add_task(self._execute_check_async, project_id)
        
        return CheckExecuteResponse(project_id=project_id, status="checking")
    
    def _execute_check_async(self, project_id: str):
        """バックグラウンドでチェック実行"""
        import asyncio
        asyncio.run(self._execute_check_task(project_id))
    
    async def _execute_check_task(self, project_id: str):
        """実際のチェック処理"""
        from rules.datacheck_comparison_rules import COMPARISON_RULES
        
        try:
            documents = get_images_by_project_id(project_id)
            
            # ドキュメントをタイプ別に分類（IDも保持）
            doc_map = {}
            doc_id_map = {}
            for doc in documents:
                doc_type = doc.get("document_type")
                # extracted_infoから抽出データを取得
                extracted_info = doc.get("extracted_info", {})
                doc_map[doc_type] = extracted_info
                doc_id_map[doc_type] = doc.get("id")
            
            logger.info(f"Document types found: {list(doc_map.keys())}")
            logger.info(f"Document data sample: {json.dumps({k: str(v)[:100] for k, v in doc_map.items()}, ensure_ascii=False)}")
            
            # AgentClientを初期化
            agent_client = AgentClient()
            
            results = []
            
            # 比較1: 作業依頼書 vs INVOICE
            if "datacheck_work_order" in doc_map and "datacheck_invoice" in doc_map:
                rules = COMPARISON_RULES["work_order_vs_invoice"]
                comparison_result = await self._execute_comparison_with_llm(
                    agent_client,
                    doc_map["datacheck_work_order"],
                    doc_map["datacheck_invoice"],
                    rules
                )
                results.append({
                    "comparison_type": "work_order_vs_invoice",
                    "doc1_name": rules["doc1_name"],
                    "doc2_name": rules["doc2_name"],
                    "doc1_id": doc_id_map.get("datacheck_work_order", ""),
                    "doc2_id": doc_id_map.get("datacheck_invoice", ""),
                    **comparison_result
                })
            
            # 比較2: 作業依頼書 vs 輸出申告
            if "datacheck_work_order" in doc_map and "datacheck_export_declaration" in doc_map:
                rules = COMPARISON_RULES["work_order_vs_export"]
                comparison_result = await self._execute_comparison_with_llm(
                    agent_client,
                    doc_map["datacheck_work_order"],
                    doc_map["datacheck_export_declaration"],
                    rules
                )
                results.append({
                    "comparison_type": "work_order_vs_export",
                    "doc1_name": rules["doc1_name"],
                    "doc2_name": rules["doc2_name"],
                    "doc1_id": doc_id_map.get("datacheck_work_order", ""),
                    "doc2_id": doc_id_map.get("datacheck_export_declaration", ""),
                    **comparison_result
                })
            
            # 比較3: INVOICE vs 輸出申告
            if "datacheck_invoice" in doc_map and "datacheck_export_declaration" in doc_map:
                rules = COMPARISON_RULES["invoice_vs_export"]
                comparison_result = await self._execute_comparison_with_llm(
                    agent_client,
                    doc_map["datacheck_invoice"],
                    doc_map["datacheck_export_declaration"],
                    rules
                )
                results.append({
                    "comparison_type": "invoice_vs_export",
                    "doc1_name": rules["doc1_name"],
                    "doc2_name": rules["doc2_name"],
                    "doc1_id": doc_id_map.get("datacheck_invoice", ""),
                    "doc2_id": doc_id_map.get("datacheck_export_declaration", ""),
                    **comparison_result
                })
            
            # 結果を保存して完了
            datacheck_repository.update_project_check_result(project_id, results)
            datacheck_repository.update_project_status(project_id, "completed")
            logger.info(f"Check completed for project {project_id}")
            
        except Exception as e:
            logger.error(f"Error in check task: {e}")
            datacheck_repository.update_project_status(project_id, "check_failed")
            raise
    
    async def _execute_comparison_with_llm(
        self,
        agent_client: AgentClient,
        doc1_data: dict,
        doc2_data: dict,
        rules: dict
    ) -> dict:
        """LLMを使って比較実行"""
        
        # システムプロンプト
        system_prompt = """あなたは2つのドキュメントのデータを比較する専門家です。

# 判断基準
1. **表記ゆれは許容**: "ABC Company" と "ABC Co., Ltd." は同一とみなす
2. **言語の違いは許容**: "東京" と "Tokyo" は同一とみなす
3. **数値の単位は無視**: "1,500 kg" と "1500" は同一とみなす（数値部分のみ比較）
4. **港コード比較**: 港名の場合は lookup_port_code ツールを使って港コードを取得し比較
5. **計算ロジック**: FOB価格の場合は CIF * 0.9 を計算して検証（誤差5%許容）

# 重要: 必ず以下のJSON形式で回答してください
他の説明文は一切不要です。JSONのみを出力してください。

{
  "results": [
    {
      "field1": "フィールド名1",
      "field2": "フィールド名2",
      "value1": "値1",
      "value2": "値2",
      "match": true,
      "reason": "判断理由"
    }
  ],
  "total": 5,
  "matched": 3
}"""
        
        # ユーザープロンプト
        prompt = f"""以下の項目について、2つのドキュメントの値が一致しているか判断してください。

# ドキュメント1: {rules["doc1_name"]}
{json.dumps(doc1_data, ensure_ascii=False, indent=2)}

# ドキュメント2: {rules["doc2_name"]}
{json.dumps(doc2_data, ensure_ascii=False, indent=2)}

# 比較項目
{json.dumps(rules["field_pairs"], ensure_ascii=False, indent=2)}"""
        
        # AgentCoreを呼び出し
        agent_result = await agent_client.invoke_agent(
            messages=[],
            system_prompt=system_prompt,
            prompt=prompt,
            model_info={
                "modelId": settings.MODEL_ID,
                "region": settings.MODEL_REGION
            }
        )
        
        # 結果をパース
        comparison_data = self._parse_agent_comparison_result(agent_result)
        
        # レスポンス形式に整形
        items = []
        for i, pair in enumerate(rules["field_pairs"]):
            result = comparison_data["results"][i] if i < len(comparison_data.get("results", [])) else {}
            items.append({
                "field1_name": pair["field1"],
                "field2_name": pair["field2"],
                "field1_display": pair["display1"],
                "field2_display": pair["display2"],
                "value1": result.get("value1", ""),
                "value2": result.get("value2", ""),
                "status": "match" if result.get("match") else "mismatch",
                "reason": result.get("reason", "")
            })
        
        total = comparison_data.get("total", len(items))
        matched = comparison_data.get("matched", 0)
        
        return {
            "total_items": total,
            "matched_items": matched,
            "match_rate": round(matched / total * 100) if total > 0 else 0,
            "items": items
        }
    
    def _parse_agent_comparison_result(self, agent_result: str) -> dict:
        """AgentCoreの結果をパース"""
        
        # JSON部分を抽出（マークダウンのコードブロックなどを除去）
        json_match = re.search(r'\{[\s\S]*\}', agent_result)
        if json_match:
            json_str = json_match.group(0)
            try:
                return json.loads(json_str)
            except:
                pass
        
        # パースに失敗した場合はデフォルト値を返す
        logger.warning(f"Failed to parse agent result: {agent_result}")
        return {"results": [], "total": 0, "matched": 0}
    
    async def get_project(self, project_id: str):
        """プロジェクト情報を取得"""
        project = datacheck_repository.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")
        
        documents = get_images_by_project_id(project_id)
        
        # OCR処理中の場合、全ドキュメントが完了しているかチェック
        if project["status"] == "ocr_processing":
            all_completed = all(doc.get("status") == "completed" for doc in documents)
            if all_completed and len(documents) == 3:
                # 全て完了したらステータスを更新
                datacheck_repository.update_project_status(project_id, "ocr_completed")
                project["status"] = "ocr_completed"
                logger.info(f"All OCR completed for project {project_id}")
        
        return ProjectResponse(
            project_id=project["project_id"],
            name=project.get("name"),
            status=project["status"],
            created_at=project["created_at"],
            documents=[{
                "id": doc["id"],
                "document_type": doc.get("document_type"),
                "filename": doc["filename"],
                "status": doc["status"],
                "ocr_confirmed": doc.get("ocr_confirmed", False)
            } for doc in documents],
            check_result=project.get("check_results")
        )
    
    async def list_projects(self):
        """プロジェクト一覧を取得"""
        projects = datacheck_repository.list_projects()
        
        return {
            "projects": [{
                "project_id": p["project_id"],
                "name": p.get("name"),
                "status": p["status"],
                "created_at": p["created_at"]
            } for p in projects]
        }
    
    async def save_feedback(self, project_id: str, request: FeedbackRequest):
        """フィードバックを保存"""
        from datetime import datetime, timezone
        
        feedback_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()
        
        feedback_data = {
            'feedback_id': feedback_id,
            'project_id': project_id,
            'timestamp': timestamp,
            'feedback_type': request.feedback_type,
            'comparison': {
                'doc1_name': request.doc1_name,
                'doc2_name': request.doc2_name,
                'doc1_id': request.doc1_id,
                'doc2_id': request.doc2_id
            },
            'check_item': {
                'field1_name': request.field1_name,
                'field1_display': request.field1_display,
                'field2_name': request.field2_name,
                'field2_display': request.field2_display,
                'value1': request.value1,
                'value2': request.value2,
                'status': request.status,
                'reason': request.reason
            }
        }
        
        datacheck_repository.save_feedback(feedback_data)
        
        return {"status": "success", "feedback_id": feedback_id}
    
    async def get_recommend_data(self, project_id: str):
        """ドックレシート用のレコメンドデータを生成"""
        # プロジェクトを取得
        project = datacheck_repository.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")
        
        # 保存データがあればそれを返す（レコメンデーション付与）
        if project.get("dock_receipt_data"):
            saved_data = project["dock_receipt_data"]
            fields = saved_data.get("fields", [])
            
            # 空フィールドにレコメンデーションを追加
            recommendations = {
                "container_number": "CLPを確認しましょう",
                "ship_number": "CLPを確認しましょう",
                "booking_number": "Booking Confirmationを確認しましょう"
            }
            
            for field in fields:
                if not field.get("filled") and field["name"] in recommendations:
                    field["recommendation"] = recommendations[field["name"]]
            
            return {
                "project_id": project_id,
                "fill_rate": saved_data.get("fill_rate", 0),
                "filled_count": saved_data.get("filled_count", 0),
                "total_count": saved_data.get("total_count", 0),
                "fields": fields
            }
        
        # 保存データがなければ計算
        documents = get_images_by_project_id(project_id)
        
        if not documents:
            raise ValueError(f"Project not found: {project_id}")
        
        # ドキュメントタイプ別に分類
        doc_map = {}
        for doc in documents:
            doc_type = doc.get("document_type")
            doc_map[doc_type] = {
                "id": doc.get("id"),
                "data": doc.get("extracted_info", {})
            }
        
        # フィールドマッピング定義
        field_mappings = [
            {"name": "exporter_name", "display": "輸出者名", "doc_type": "datacheck_work_order", "field": "exporter_name"},
            {"name": "deadline", "display": "締切日", "doc_type": "datacheck_work_order", "field": "deadline"},
            {"name": "loading_port", "display": "積込港", "doc_type": "datacheck_work_order", "field": "loading_port"},
            {"name": "final_destination", "display": "最終仕向地", "doc_type": "datacheck_work_order", "field": "final_destination"},
            {"name": "invoice_no", "display": "Invoice No.", "doc_type": "datacheck_invoice", "field": "invoice_no"},
            {"name": "country_code", "display": "国コード", "doc_type": "datacheck_export_declaration", "field": "country_code"},
            {"name": "export_cert_division", "display": "輸出認証等区分", "doc_type": "datacheck_export_declaration", "field": "export_cert_division"},
            {"name": "container_number", "display": "コンテナナンバー", "doc_type": None, "field": None, "recommendation": "CLPを確認しましょう"},
            {"name": "ship_number", "display": "船番号", "doc_type": None, "field": None, "recommendation": "CLPを確認しましょう"},
            {"name": "booking_number", "display": "Booking Number", "doc_type": None, "field": None, "recommendation": "Booking Confirmationを確認しましょう"},
        ]
        
        # ドキュメント名マッピング
        doc_names = {
            "datacheck_work_order": "作業依頼書",
            "datacheck_invoice": "INVOICE",
            "datacheck_export_declaration": "輸出申告事項登録"
        }
        
        # データをマッピング
        fields = []
        for mapping in field_mappings:
            if mapping["doc_type"] and mapping["field"]:
                doc = doc_map.get(mapping["doc_type"])
                if doc:
                    value = doc["data"].get(mapping["field"], "")
                    fields.append({
                        "name": mapping["name"],
                        "display": mapping["display"],
                        "value": value,
                        "source": doc_names.get(mapping["doc_type"]),
                        "source_document_id": doc["id"],
                        "filled": bool(value)
                    })
                else:
                    fields.append({
                        "name": mapping["name"],
                        "display": mapping["display"],
                        "value": "",
                        "source": None,
                        "filled": False
                    })
            else:
                # 未入力フィールド（レコメンデーション付き）
                fields.append({
                    "name": mapping["name"],
                    "display": mapping["display"],
                    "value": "",
                    "source": None,
                    "filled": False,
                    "recommendation": mapping.get("recommendation")
                })
        
        filled_count = sum(1 for f in fields if f["filled"])
        
        return {
            "project_id": project_id,
            "fill_rate": round((filled_count / len(fields)) * 100),
            "filled_count": filled_count,
            "total_count": len(fields),
            "fields": fields
        }
    
    async def save_dock_receipt(self, project_id: str, fields: list):
        """ドックレシートデータを保存"""
        filled_count = sum(1 for f in fields if f.get("filled"))
        total_count = len(fields)
        
        dock_receipt_data = {
            "fields": fields,
            "fill_rate": round((filled_count / total_count) * 100) if total_count > 0 else 0,
            "filled_count": filled_count,
            "total_count": total_count,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        datacheck_repository.update_project_dock_receipt(project_id, dock_receipt_data)
        
        return {"status": "success", "project_id": project_id}

