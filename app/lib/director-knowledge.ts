export const SYMBOL_OBJECTS = [
  { emotion: "grief", objects: ["空椅子", "冷掉的饭", "旧照片", "未接电话"], cameraRule: "slow push-in to object", lightingRule: "cold blue side light" },
  { emotion: "regret", objects: ["未发送消息", "停住的手", "关上的门", "遗落物品"], cameraRule: "hold then slight push", lightingRule: "dim neutral light" },
  { emotion: "love", objects: ["手", "目光", "共享食物", "围巾"], cameraRule: "gentle close-up", lightingRule: "warm soft light" },
  { emotion: "loneliness", objects: ["空房间", "远灯", "窗外夜景", "影子"], cameraRule: "wide static shot", lightingRule: "low contrast cold light" },
  { emotion: "nostalgia", objects: ["旧照片", "录音机", "老家具", "泛黄信件"], cameraRule: "slow pan across object", lightingRule: "warm faded light" },
  { emotion: "fear", objects: ["黑暗角落", "半开的门", "影子", "闪烁灯"], cameraRule: "handheld slight shake", lightingRule: "high contrast low key" },
  { emotion: "hope", objects: ["光线", "窗", "天空", "打开的门"], cameraRule: "slow upward tilt", lightingRule: "bright warm light" },
  { emotion: "despair", objects: ["黑暗房间", "空杯子", "散落物品", "地面"], cameraRule: "static long hold", lightingRule: "very low light" },
  { emotion: "anger", objects: ["紧握拳头", "破碎物件", "桌面", "手机"], cameraRule: "quick push-in", lightingRule: "harsh top light" },
  { emotion: "playful", objects: ["宠物", "散落玩具", "翻倒物品", "地面"], cameraRule: "quick cuts", lightingRule: "bright natural light" },
  { emotion: "guilt", objects: ["低头", "手指", "影子", "镜子"], cameraRule: "close-up hold", lightingRule: "side shadow light" },
  { emotion: "tension", objects: ["门", "眼睛", "呼吸", "影子"], cameraRule: "slow push then cut", lightingRule: "low key contrast" },
  { emotion: "comfort", objects: ["拥抱", "手", "毯子", "灯光"], cameraRule: "gentle close", lightingRule: "soft warm light" },
  { emotion: "betrayal", objects: ["背影", "手机", "门", "视线回避"], cameraRule: "cut to reaction", lightingRule: "cold split light" },
  { emotion: "shock", objects: ["眼睛", "掉落物", "静止空间"], cameraRule: "fast cut then freeze", lightingRule: "flash contrast" },
  { emotion: "release", objects: ["呼气", "放下物品", "手", "地面"], cameraRule: "slow pull back", lightingRule: "soft diffused light" },
  { emotion: "bittersweet", objects: ["微笑与泪", "光影", "手", "旧物"], cameraRule: "linger close-up", lightingRule: "mixed warm/cool" },
  { emotion: "yearning", objects: ["远方", "窗", "天空", "手"], cameraRule: "slow push outward", lightingRule: "soft fading light" },
  { emotion: "determination", objects: ["拳头", "眼神", "站姿"], cameraRule: "push-in firm", lightingRule: "hard directional" },
  { emotion: "panic", objects: ["呼吸", "手", "空间混乱", "脸"], cameraRule: "rapid shaky cuts", lightingRule: "flickering light" }
]

export const SUBTEXT_TEMPLATES = [
  { situation: "想念去世的妈妈", surface: "饭做好了。", subtext: "你不在了", forbidden: "我很想你妈妈" },
  { situation: "错过机会", surface: "算了。", subtext: "我后悔了", forbidden: "我后悔没做" },
  { situation: "暗恋", surface: "你最近挺忙吧。", subtext: "我在关注你", forbidden: "我喜欢你" },
  { situation: "分手", surface: "早点休息。", subtext: "我们结束了", forbidden: "我们分手吧" },
  { situation: "愧疚", surface: "没事的。", subtext: "其实我很难受", forbidden: "我很内疚" },
  { situation: "失望", surface: "挺好的。", subtext: "我不满意", forbidden: "我很失望" },
  { situation: "不舍", surface: "你走吧。", subtext: "我不想你走", forbidden: "我舍不得你" },
  { situation: "无奈", surface: "也只能这样了。", subtext: "我没办法", forbidden: "我很无奈" },
  { situation: "愤怒", surface: "随你。", subtext: "我很生气", forbidden: "我很愤怒" },
  { situation: "释怀", surface: "这样也好。", subtext: "我放下了", forbidden: "我已经释怀" },
  { situation: "孤独", surface: "挺安静的。", subtext: "我很孤单", forbidden: "我很孤独" },
  { situation: "遗憾", surface: "差一点。", subtext: "我错过了", forbidden: "我很遗憾" },
  { situation: "依赖", surface: "你在就好。", subtext: "我需要你", forbidden: "我离不开你" },
  { situation: "结束关系", surface: "以后别来了。", subtext: "我们结束了", forbidden: "我们分开吧" },
  { situation: "期待", surface: "应该会来吧。", subtext: "我在等", forbidden: "我很期待" }
]

export const EMOTION_TRANSITIONS = [
  { from: "calm", to: "grief", transition: "物件触发", camera: "slow push-in", duration: "3秒" },
  { from: "calm", to: "tension", transition: "异常出现", camera: "hold then cut", duration: "2秒" },
  { from: "joy", to: "sadness", transition: "回忆打断", camera: "cut to close", duration: "3秒" },
  { from: "hope", to: "despair", transition: "失败", camera: "drop frame", duration: "3秒" },
  { from: "tension", to: "release", transition: "解决", camera: "pull back", duration: "4秒" },
  { from: "loneliness", to: "hope", transition: "光出现", camera: "tilt up", duration: "3秒" },
  { from: "calm", to: "shock", transition: "突发事件", camera: "quick cut", duration: "1秒" },
  { from: "regret", to: "grief", transition: "记忆强化", camera: "slow zoom", duration: "3秒" },
  { from: "anger", to: "guilt", transition: "反思", camera: "hold", duration: "3秒" },
  { from: "joy", to: "bittersweet", transition: "细节发现", camera: "linger", duration: "3秒" }
]

export const HOOK_FORMULAS = [
  { type: "visual_shock", description: "开场必须有突然动作或破坏", example: "猫爪推倒杯子慢动作特写" },
  { type: "extreme_close", description: "极近特写制造压迫", example: "眼睛流泪ECU" },
  { type: "unexpected_sound", description: "先声后画", example: "玻璃破裂声后切画面" },
  { type: "frozen_frame", description: "静止画面引发疑问", example: "人物僵住不动" },
  { type: "contrast_light", description: "强烈光影对比", example: "半脸冷光半脸暖光" },
  { type: "motion_entry", description: "物体突然进入画面", example: "手突然伸入画面" },
  { type: "empty_space", description: "空镜开场", example: "空椅子静止" },
  { type: "slow_motion", description: "慢动作制造关注", example: "水滴慢落" }
]

export const ENDING_FORMULAS = [
  { type: "object_hold", description: "物件停留", music: "fade out", example: "空椅子静止5秒" },
  { type: "reverse_callback", description: "呼应开头", music: "low", example: "再次出现同一物件" },
  { type: "static_close", description: "静止收尾", music: "silent", example: "人物不动看远方" },
  { type: "slow_pull_back", description: "拉远结束", music: "fade", example: "镜头慢慢拉远" },
  { type: "open_end", description: "未完成动作", music: "low", example: "手停在半空" },
  { type: "breath_end", description: "呼吸结束", music: "silent", example: "人物深呼吸停住" },
  { type: "sound_only", description: "画面结束声音延续", music: "audio hold", example: "画面黑但有呼吸声" },
  { type: "fade_to_black", description: "渐黑结束", music: "fade out", example: "画面慢慢变黑" }
]
