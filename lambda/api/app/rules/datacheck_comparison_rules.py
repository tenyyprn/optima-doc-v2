"""データチェック比較ルール定義"""

COMPARISON_RULES = {
    "work_order_vs_invoice": {
        "doc1_type": "datacheck_work_order",
        "doc1_name": "作業依頼書",
        "doc2_type": "datacheck_invoice",
        "doc2_name": "INVOICE",
        "field_pairs": [
            {
                "field1": "exporter_name",
                "field2": "pay_to",
                "display1": "輸出者名",
                "display2": "Pay to",
                "hint": "会社名の表記ゆれを許容（例: 'ABC Company' = 'ABC Co., Ltd.'）"
            },
            {
                "field1": "total_quantity",
                "field2": "total_pallets",
                "display1": "総個数",
                "display2": "TOTAL PALLETS",
                "hint": "数値として比較。単位やカンマは無視"
            },
            {
                "field1": "total_weight_net",
                "field2": "total_kgs",
                "display1": "総重量(ネット)",
                "display2": "TOTAL KGS",
                "hint": "数値として比較。単位やカンマは無視"
            },
            {
                "field1": "loading_port",
                "field2": "country_of_origin",
                "display1": "積込港",
                "display2": "COUNTRY OF ORIGIN",
                "hint": "lookup_port_codeツールを使って港コードを取得し比較。言語の違いを許容"
            },
            {
                "field1": "final_destination",
                "field2": "shipped_to",
                "display1": "最終仕向地",
                "display2": "To(SHIPPED TO)",
                "hint": "住所や地名の表記ゆれを許容"
            }
        ]
    },
    "work_order_vs_export": {
        "doc1_type": "datacheck_work_order",
        "doc1_name": "作業依頼書",
        "doc2_type": "datacheck_export_declaration",
        "doc2_name": "輸出申告事項登録",
        "field_pairs": [
            {
                "field1": "exporter_name",
                "field2": "exporter_name",
                "display1": "輸出者名",
                "display2": "輸出者名",
                "hint": "会社名の表記ゆれを許容"
            },
            {
                "field1": "container_count",
                "field2": "container_count",
                "display1": "コンテナ本数",
                "display2": "コンテナ本数",
                "hint": "数値として比較"
            },
            {
                "field1": "total_quantity",
                "field2": "cargo_quantity",
                "display1": "総個数",
                "display2": "貨物個数",
                "hint": "数値として比較"
            },
            {
                "field1": "total_weight_gross",
                "field2": "cargo_weight",
                "display1": "総重量(グロス)",
                "display2": "貨物重量",
                "hint": "数値として比較"
            },
            {
                "field1": "vanning_location",
                "field2": "vanning_location",
                "display1": "バンニング場所",
                "display2": "バンニング場所",
                "hint": "地名の表記ゆれを許容"
            },
            {
                "field1": "final_destination",
                "field2": "country_code",
                "display1": "最終仕向地",
                "display2": "国コード",
                "hint": "lookup_port_codeツールを使って港コードを取得し比較"
            },
            {
                "field1": "delivery_destination",
                "field2": "security_area",
                "display1": "搬入先",
                "display2": "保全地域",
                "hint": "地名の表記ゆれを許容"
            }
        ]
    },
    "invoice_vs_export": {
        "doc1_type": "datacheck_invoice",
        "doc1_name": "INVOICE",
        "doc2_type": "datacheck_export_declaration",
        "doc2_name": "輸出申告事項登録",
        "field_pairs": [
            {
                "field1": "pay_to",
                "field2": "exporter_name",
                "display1": "Pay to",
                "display2": "輸出者名",
                "hint": "会社名の表記ゆれを許容"
            },
            {
                "field1": "invoice_no",
                "field2": "invoice_number",
                "display1": "Invoice No.",
                "display2": "仕入書番号",
                "hint": "番号の表記ゆれを許容（ハイフン、スペースなど）"
            },
            {
                "field1": "billed_to",
                "field2": "importer",
                "display1": "Billed to",
                "display2": "輸入者",
                "hint": "会社名の表記ゆれを許容"
            },
            {
                "field1": "invoice_price_cif",
                "field2": "fob_price",
                "display1": "仕入書価格(CIF)",
                "display2": "FOB価格",
                "hint": "FOB = CIF * 0.9 の計算式で検証。誤差5%以内なら一致とみなす"
            }
        ]
    }
}
