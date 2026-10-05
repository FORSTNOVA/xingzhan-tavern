# 星栈酒馆

新的应用名称为「星栈酒馆」。图标采用深靛蓝背景、暖金色灯笼和星光，使用 Android 原生矢量资源，不包含新增大尺寸位图。

应用桌面名称、常驻通知标题及图标、通知渠道名称、启动及重启提示、管理页面标题已更新。支持自适应图标和 Android 13+ 单色主题图标。

保持原有应用 ID 与签名，可以覆盖安装并保留现有应用数据。

图标资源位于 `app/src/main/res/drawable/ic_launcher_foreground.xml`，预览位于 `artifacts/branding/xingzhan-icon-preview.png`，SVG 位于 `artifacts/branding/xingzhan-icon.svg`。可运行 `python scripts/render-brand-icon.py` 重新生成预览。

构建验证：`assembleDebug` 和 `lintDebug` 通过，APK 资源检查确认应用名称和图标引用正确。手机 USB 调试当前未授权，本轮尚未安装验证。
