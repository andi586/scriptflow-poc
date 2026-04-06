# ScriptFlow 视觉一致性架构规范
日期：2026-04-06
三模型综合裁决

## 核心原则
NEL不直接写Kling prompt
NEL先写视觉圣经
编译器再写prompt

## 新数据结构
NEL输出新增：
- character_bible（角色视觉档案）
- scene_bible（场景视觉档案）
- continuity_rules（连续性规则）

## 角色视觉档案必填字段
- hairstyle（发型）
- outfit_base（服装主体）
- footwear（鞋子）
- accessories（配饰）
- color_palette（色板）
- forbidden_traits（禁止出现的元素）

## Kling prompt模板
[角色固定描述] + [场景锚点] + [动作] + [连续性] + [负面约束]

## 负面约束示例
现代角色：no skirt, no ancient costume, no sandals
古代角色：no modern objects, no suit, no sneakers

## MVP优先级
P0: NEL输出character_bible
P0: Prompt Builder编译函数
P0: 用户照片作为Element
P1: 场景时代锁定
P2: 用户视觉档案预览
