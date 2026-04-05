# ScriptFlow 配音旁白字幕三统一技术方案
日期：2026-04-05
四模型综合裁决

## 核心原则
用户用什么语言输入
配音/旁白/字幕就用什么语言输出

## 技术路径
输入任何语言
→ fast-langdetect检测语言
→ 翻译成英文给NEL
→ NEL生成英文剧本
→ Claude戏剧化回译→用户语言台词
→ ElevenLabs: 用户语言+language_code
→ FFmpeg: 用户语言字幕+对应字体
→ 成品三统一

## MVP支持语言
zh 中文（优先）
en 英文（已有）
es 西班牙文
ja 日文
ko 韩文

## Railway字体安装
fonts-noto-core
fonts-noto-cjk
fonts-noto-color-emoji

## ElevenLabs参数
model_id: eleven_multilingual_v2
language_code: userLanguage (ISO 639-1)

## 字体映射
zh/ja/ko → NotoSansCJK-Regular.ttc
ar → NotoSansArabic-Regular.ttf
其他 → NotoSans-Regular.ttf

## 成本
几乎零新增成本
生成时间增加约1-3秒
