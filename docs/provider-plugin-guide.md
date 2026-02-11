# Provider 插件开发指南（SNLite 7.0.0）

本文档说明如何为 SNLite 开发并发布第三方 Provider 插件。

## 1. 插件目标

Provider 插件用于扩展模型后端，例如接入新的推理服务、网关或代理层。

SNLite 会在启动时扫描 Python entry points 组：

- `snlite.providers`

## 2. 最小接口

你的 provider 需要实现以下异步方法（与 `snlite.providers.base.Provider` 对齐）：

- `list_models() -> list[dict]`
- `load(model_id: str, **kwargs) -> dict`
- `unload() -> None`
- `chat(model_id, messages, params) -> str`
- `stream_chat(model_id, messages, params, cancelled) -> AsyncIterator[dict]`

`stream_chat` 建议每次 yield 形如：

```python
{"thinking": "...", "content": "..."}
```

## 3. 打包与注册

在你的插件项目 `pyproject.toml` 中添加：

```toml
[project.entry-points."snlite.providers"]
my_provider = "my_pkg.provider:plugin_entry"
```

其中 `plugin_entry` 可以返回：

- provider 实例
- provider 类（SNLite 会自动实例化）
- 返回 provider 的工厂函数

## 4. 参考示例

SNLite 内置了一个示例插件：

- Entry point: `echo`
- 实现文件：`snlite/plugins/example_provider.py`

可以先加载 `echo` 验证插件链路是否正常。

## 5. 启用/限制插件

通过环境变量控制白名单：

```bash
SNLITE_PROVIDER_PLUGINS=*               # 默认：允许全部
SNLITE_PROVIDER_PLUGINS=echo,my_provider
```

如果插件不在白名单中，会被记录为 blocked，不会加载。

## 6. 诊断接口

SNLite 提供：

- `GET /api/plugins/providers`：查看插件加载状态/错误
- `GET /api/models`：查看每个 provider 的 models 与来源

## 7. 开发建议

- 把网络错误转成可读异常信息，便于前端展示。
- `stream_chat` 中高频 token 建议小批量聚合后再 yield，降低 SSE 事件频率。
- 使用超时与重试策略，避免卡死。
- 使用稳定的 provider `name`，避免重名冲突。
