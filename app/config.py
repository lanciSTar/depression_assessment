#AI辅助生成：DeepSeek-R1, 2026.4.13
"""基本配置"""
import os

# 基础路径
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(BASE_DIR, "models_cache")
DB_PATH = os.path.join(BASE_DIR,"data","depression.db")
#base dir == E:\\must_last\\depression_assessment

# HAMD 模型配置
HAMD_BASE_MODEL = os.path.join(CACHE_DIR, "Qwen", "Qwen2.5-7B-Instruct")
HAMD_LORA_PATH = os.path.join(CACHE_DIR, "hamd_lora")

# ASR 模型配置
ASR_MODEL_PATH = os.path.join(CACHE_DIR, "iic", "SenseVoiceSmall")
ASR_DEVICE = "cuda:0"         
ASR_LANGUAGE = "zh"

# SDS 音频模型配置
SDS_MODEL_PATH = os.path.join(CACHE_DIR, "sds_model.pkl")
SDS_SCALER_PATH = os.path.join(CACHE_DIR, "sds_scaler.pkl")
AUDIO_SR = 16000

# 综合评估权重（可调）
WEIGHT_VOICE_SDS = 0.4         # 语音SDS分数权重
WEIGHT_TEXT_HAMD = 0.6         # 文本HAMD总分权重（未来可改为各因子加权）

# 抑郁程度分级（HAMD总分）
HAMD_LEVELS = [
    (0, 7, "正常/无抑郁"),
    (8, 17, "可能存在抑郁（轻度）"),
    (18, 24, "肯定存在抑郁（中度）"),
    (25, 52, "严重抑郁（重度）")
]

# SDS 分数分级（原始分，0~100）
SDS_LEVELS = [
    (0, 52, "无抑郁"),
    (53, 62, "轻度抑郁"),
    (63, 72, "中度抑郁"),
    (73, 100, "重度抑郁")
]

# 17项名称
ITEM_NAMES = [
    "抑郁情绪", "有罪感", "自杀观念",
    "入睡困难", "睡眠不深", "早醒",
    "工作和兴趣", "迟缓", "激越",
    "精神性焦虑", "躯体性焦虑",
    "胃肠道症状", "全身症状", "生殖系统症状",
    "疑病", "体重减轻", "自知力"
]

# 因子名称与通俗描述、建议
HAMD_ADVICE_MAP = {
    "抑郁情绪": {
        "trigger": lambda score: score >= 2,
        "desc": "情绪持续低落",
        "advice": "尝试每天记录三件值得感恩的小事；与信任的人倾诉；如果情绪难以自行调节，可寻求心理咨询。"
    },
    "有罪感": {
        "trigger": lambda score: score >= 2,
        "desc": "过度自责或内疚",
        "advice": "练习自我接纳，挑战“都是我的错”的想法；告诉自己“没有人是完美的”。"
    },
    "自杀观念": {
        "trigger": lambda score: score >= 1,
        "desc": "存在自杀意念",
        "advice": "⚠️ 请立即寻求专业帮助！拨打心理援助热线（如北京24小时：010-82951332），或前往医院心理科就诊。"
    },
    "入睡困难": {
        "trigger": lambda score: score >= 1,
        "desc": "入睡困难",
        "advice": "固定上床和起床时间；睡前1小时远离手机；尝试听轻音乐或白噪音。"
    },
    "睡眠不深": {
        "trigger": lambda score: score >= 1,
        "desc": "睡眠浅、多梦易醒",
        "advice": "睡前做放松练习（如4-7-8呼吸法）；减少咖啡因摄入；保持卧室黑暗安静。"
    },
    "早醒": {
        "trigger": lambda score: score >= 1,
        "desc": "早醒且无法再入睡",
        "advice": "醒后不要躺在床上焦虑，起床做轻度活动；调整作息，避免白天补觉过长。"
    },
    "工作和兴趣": {
        "trigger": lambda score: score >= 2,
        "desc": "对工作/兴趣丧失热情",
        "advice": "尝试重新参与曾经喜欢的活动，哪怕每天只做5分钟；设定微小可行的目标。"
    },
    "迟缓": {
        "trigger": lambda score: score >= 2,
        "desc": "思维或行动变得迟缓",
        "advice": "进行温和运动如散步、拉伸；将大任务拆解为小步骤，逐步完成。"
    },
    "激越": {
        "trigger": lambda score: score >= 2,
        "desc": "烦躁不安、坐立不宁",
        "advice": "尝试正念呼吸或渐进式肌肉放松；将注意力转移到具体事物上（如整理桌面）。"
    },
    "精神性焦虑": {
        "trigger": lambda score: score >= 2,
        "desc": "持续紧张、担忧",
        "advice": "练习“焦虑时间”技术：每天固定15分钟写下所有担忧，其他时间出现焦虑时告诉自己“留到焦虑时间再想”。"
    },
    "躯体性焦虑": {
        "trigger": lambda score: score >= 2,
        "desc": "心慌、胸闷等身体不适",
        "advice": "进行腹式呼吸（吸气4秒→屏息2秒→呼气6秒）；如症状频繁，建议体检排除生理问题。"
    },
    "胃肠道症状": {
        "trigger": lambda score: score >= 1,
        "desc": "食欲减退或胃肠不适",
        "advice": "少食多餐，选择易消化食物；避免辛辣油腻；记录饮食与情绪关系。"
    },
    "全身症状": {
        "trigger": lambda score: score >= 1,
        "desc": "乏力、身体沉重",
        "advice": "保证基础营养（蛋白质、B族维生素）；白天进行短时散步，改善血液循环。"
    },
    "生殖系统症状": {
        "trigger": lambda score: score >= 1,
        "desc": "性欲减退或功能变化",
        "advice": "与伴侣坦诚沟通；必要时咨询医生，排除药物或激素影响。"
    },
    "疑病": {
        "trigger": lambda score: score >= 2,
        "desc": "过度担心患病",
        "advice": "限制上网查病时间；信任医生检查结果；练习“接纳不确定性”。"
    },
    "体重减轻": {
        "trigger": lambda score: score >= 1,
        "desc": "非刻意减重导致体重下降",
        "advice": "增加营养密度高的食物（坚果、酸奶、鸡蛋）；如持续下降需就医排查。"
    },
    "自知力": {
        "trigger": lambda score: score >= 1,
        "desc": "对自身状况认识不足",
        "advice": "建议由家人或朋友陪同就医，帮助描述情况。"
    }
}

# 服务器配置
API_HOST = "0.0.0.0"
API_PORT = 8000
MAX_AUDIO_SIZE_MB = 20
TEMP_FILE_PREFIX = "dep_temp_"
