from __future__ import annotations


def plugin_entry() -> dict:
    return {
        "code": "ja",
        "name": "日本語 (サンプル)",
        "messages": {
            "ui.language": "言語",
            "ui.primary": "重要",
            "ui.common": "一般",
            "ui.secondary": "補助",
            "status.idle": "待機中",
            "status.no_model": "モデル未ロード",
            "toast.copied": "コピーしました",
            "toast.copy_failed": "コピー失敗",
        },
    }
