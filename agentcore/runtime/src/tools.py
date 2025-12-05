"""Tool management for agent runtime."""

import json
import logging
import os
from typing import Any, Optional

import boto3
from boto3.dynamodb.conditions import Key, Attr
from strands import tool

logger = logging.getLogger(__name__)


class ToolManager:
    """Manages tools for the agent"""

    def __init__(self):
        region = os.environ.get('AWS_REGION')
        self.dynamodb = boto3.resource('dynamodb', region_name=region)
        self.port_codes_table_name = os.environ.get('PORT_CODES_TABLE', '')

    def get_port_code_tools(self) -> list[Any]:
        """Get port code lookup tools"""
        
        table = self.dynamodb.Table(self.port_codes_table_name) if self.port_codes_table_name else None

        @tool
        def lookup_port_code(
            port_identifier: str,
            search_mode: str = "exact"
        ) -> dict:
            """港コードまたは港名から港情報を検索
            
            Args:
                port_identifier: 港コードまたは港名（例: "JAX", "Jacksonville", "横浜"）
                search_mode: 検索モード
                    - "exact": 港コードで完全一致検索（デフォルト）
                    - "name": 港名で部分一致検索
                    - "all": 全件取得（port_identifierは無視される）
            
            Returns:
                検索結果の辞書
                - exact/name: {"port_code": str, "port_name": str, "country": str} または None
                - all: {"ports": [{"port_code": str, "port_name": str, "country": str}, ...], "count": int}
            
            Examples:
                - lookup_port_code("JAX", "exact") -> Jacksonville港の情報
                - lookup_port_code("Jack", "name") -> 港名に"Jack"を含む港のリスト
                - lookup_port_code("", "all") -> 全港コードのリスト
            """
            if not table:
                logger.error("PORT_CODES_TABLE not configured")
                return {"error": "Port codes table not available"}
            
            try:
                if search_mode == "all":
                    # 全件取得
                    response = table.scan()
                    ports = response.get('Items', [])
                    logger.info(f"Retrieved all {len(ports)} port codes")
                    return {"ports": ports, "count": len(ports)}
                
                elif search_mode == "exact":
                    # 港コードで完全一致検索
                    port_code_upper = port_identifier.upper().strip()
                    response = table.get_item(Key={'port_code': port_code_upper})
                    item = response.get('Item')
                    
                    if item:
                        logger.info(f"Found port by code: {port_code_upper}")
                        return item
                    else:
                        logger.info(f"Port not found: {port_code_upper}")
                        return None
                
                elif search_mode == "name":
                    # 港名で部分一致検索
                    normalized_input = port_identifier.lower().strip()
                    response = table.scan(
                        FilterExpression=Attr('port_name').contains(port_identifier) | 
                                       Attr('port_name').contains(port_identifier.upper()) |
                                       Attr('port_name').contains(port_identifier.lower())
                    )
                    items = response.get('Items', [])
                    
                    if items:
                        logger.info(f"Found {len(items)} ports matching: {port_identifier}")
                        return {"ports": items, "count": len(items)}
                    else:
                        logger.info(f"No ports found matching: {port_identifier}")
                        return {"ports": [], "count": 0}
                
                else:
                    return {"error": f"Invalid search_mode: {search_mode}"}
                
            except Exception as e:
                logger.error(f"Error in lookup_port_code: {e}")
                return {"error": str(e)}

        return [lookup_port_code]

    def get_all_tools(self) -> list[Any]:
        """Get all available tools"""
        port_code_tools = self.get_port_code_tools()
        logger.info(f"Total tools loaded: {len(port_code_tools)}")
        return port_code_tools

    def get_tool_info_for_registration(self) -> list[dict]:
        """Get tool information for DynamoDB registration"""
        tool_info = []

        custom_tools = self.get_port_code_tools()
        for tool in custom_tools:
            tool_name = getattr(tool, '__name__', str(tool))
            tool_doc = getattr(tool, '__doc__', '') or ''
            description = tool_doc.strip().split('\n')[0] if tool_doc else ''
            tool_info.append({
                'name': tool_name,
                'description': description
            })
            logger.info(f"Found custom tool: {tool_name}")

        return tool_info
