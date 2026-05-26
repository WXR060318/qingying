import base64
import json
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

import httpx

from app.schemas import RECOMMENDED_USAGES, SCENE_TYPES


class VisionModelError(RuntimeError):
    pass


class VisionModelProvider(ABC):
    name: str

    @abstractmethod
    def analyze_image(self, image_path: str) -> dict[str, Any]:
        raise NotImplementedError

    def analyzeImage(self, imagePath: str) -> dict[str, Any]:
        return self.analyze_image(imagePath)

    def classifyScene(self, imagePath: str) -> str | None:
        return self.analyze_image(imagePath).get("scene_type")

    def generateCaption(self, imagePath: str) -> str | None:
        return self.analyze_image(imagePath).get("description")

    def suggestUsage(self, imagePath: str) -> str | None:
        return self.analyze_image(imagePath).get("recommended_usage")


class OpenAIVisionProvider(VisionModelProvider):
    name = "openai"

    def __init__(self, api_key: str | None, model: str, base_url: str | None = None) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = (base_url or "https://api.openai.com/v1").rstrip("/")

    def analyze_image(self, image_path: str) -> dict[str, Any]:
        if not self.api_key:
            raise VisionModelError("未配置 OpenAI API Key")
        path = Path(image_path)
        if not path.exists():
            raise VisionModelError("原始图片不存在，无法进行大模型分析")

        image_url = f"data:{_mime_type(path)};base64,{_image_base64(path)}"
        prompt = _analysis_prompt()
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_url}},
                    ],
                }
            ],
            "temperature": 0.2,
        }
        try:
            with httpx.Client(timeout=60) as client:
                response = client.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json=payload,
                )
            response.raise_for_status()
        except Exception as exc:
            raise VisionModelError(f"OpenAI Vision 调用失败：{exc}") from exc

        raw = response.json()
        content = (
            raw.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )
        parsed = _parse_json_content(content)
        parsed["raw_response"] = raw
        return _normalize_ai_result(parsed)


class QwenVLVisionProvider(VisionModelProvider):
    name = "qwen-vl"

    def analyze_image(self, image_path: str) -> dict[str, Any]:
        raise VisionModelError("Qwen-VL Provider 已预留，当前尚未配置具体调用实现")


class GeminiVisionProvider(VisionModelProvider):
    name = "gemini"

    def analyze_image(self, image_path: str) -> dict[str, Any]:
        raise VisionModelError("Gemini Vision Provider 已预留，当前尚未配置具体调用实现")


class OllamaVisionProvider(VisionModelProvider):
    name = "ollama"

    def analyze_image(self, image_path: str) -> dict[str, Any]:
        raise VisionModelError("Ollama 本地多模态 Provider 已预留，当前尚未配置具体调用实现")


class VisionModelService:
    def __init__(self, settings: dict[str, str | None]) -> None:
        self.settings = settings

    def get_provider(self) -> VisionModelProvider:
        provider = (self.settings.get("visionProvider") or self.settings.get("vision.provider") or "openai").lower()
        if provider == "openai":
            return OpenAIVisionProvider(
                api_key=self.settings.get("visionApiKey") or self.settings.get("vision.api_key"),
                model=self.settings.get("visionModel") or self.settings.get("vision.model") or "gpt-4o-mini",
                base_url=self.settings.get("visionApiBase") or self.settings.get("vision.base_url"),
            )
        if provider == "qwen-vl":
            return QwenVLVisionProvider()
        if provider == "gemini":
            return GeminiVisionProvider()
        if provider == "ollama":
            return OllamaVisionProvider()
        raise VisionModelError(f"未知大模型供应商：{provider}")

    def analyze(self, image_path: str) -> dict[str, Any]:
        return self.get_provider().analyze_image(image_path)


def _analysis_prompt() -> str:
    return (
        "你是校园活动照片筛选助手。请只输出 JSON，不要输出 Markdown。"
        "字段必须包含 scene_type、description、recommended_usage、reason、tags、confidence。"
        f"scene_type 只能从这些值中选择：{', '.join(SCENE_TYPES)}。"
        f"recommended_usage 只能从这些值中选择：{', '.join(RECOMMENDED_USAGES)}。"
        "confidence 是 0 到 1 的数字。不要识别人名或身份，不要进行人脸身份判断。"
    )


def _image_base64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def _mime_type(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if suffix == ".png":
        return "image/png"
    if suffix == ".webp":
        return "image/webp"
    return "application/octet-stream"


def _parse_json_content(content: str) -> dict[str, Any]:
    if not content:
        raise VisionModelError("大模型返回为空")
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise VisionModelError("大模型返回不是有效 JSON") from exc
    if not isinstance(parsed, dict):
        raise VisionModelError("大模型返回 JSON 结构不合法")
    return parsed


def _normalize_ai_result(result: dict[str, Any]) -> dict[str, Any]:
    tags = result.get("tags") or []
    if not isinstance(tags, list):
        tags = [str(tags)]
    confidence = result.get("confidence")
    try:
        confidence = float(confidence) if confidence is not None else None
    except (TypeError, ValueError):
        confidence = None
    return {
        "scene_type": _allowed_or_default(result.get("scene_type"), SCENE_TYPES, "待人工确认"),
        "description": str(result.get("description") or ""),
        "recommended_usage": _allowed_or_default(
            result.get("recommended_usage"),
            RECOMMENDED_USAGES,
            "活动归档",
        ),
        "reason": str(result.get("reason") or ""),
        "tags": [str(tag) for tag in tags],
        "confidence": confidence,
        "raw_response": result.get("raw_response", result),
    }


def _allowed_or_default(value: Any, allowed: list[str], default: str) -> str:
    return str(value) if value in allowed else default
