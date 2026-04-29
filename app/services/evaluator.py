# 融合多模态结果，输出综合抑郁等级
"""
接受HAMD和SDS的分数，归一化，计算同一尺度，加上权重SDS：0.3 HAMD：0.7
SDS为自评，HAMD为医生测评 故权重HAMD略高于SDS
0-20 无
21-40 轻度
41-60 中度
61-80 重度
"""

from app.services.audio_processor import sds_score,extract_feature,transcribe_audio
from app.services.text_processor import hamd_scores,predict_row_score
from app.config import WEIGHT_TEXT_HAMD,WEIGHT_VOICE_SDS,HAMD_ADVICE_MAP,ITEM_NAMES

SDS_MIN,SDS_MAX = 0,100
HAMD_MIN,HAMD_MAX = 0,52
NORMALIZATION = 100
def SDS_score(audio_path):
    """归一化SDS"""
    row_score = sds_score(extract_feature(audio_path))
    SDS_norm = row_score
    
    return SDS_norm

def HAMD_score(audio_path):
    """归一化HAMD"""
    text = transcribe_audio(audio_path)
    row_score = hamd_scores(predict_row_score(text))[1] #输出total
    normalized_hamd = (row_score - HAMD_MIN) / (HAMD_MAX - HAMD_MIN)
    HAMD_norm = NORMALIZATION * normalized_hamd
    
    return HAMD_norm   


def evaluate(SDS_row,HAMD_row):
    """SDS和HAMD加权重 再分析"""
    SDS_norm = SDS_row
    HAMD_norm = HAMD_row / 52 * 100
    total_norm = WEIGHT_VOICE_SDS * SDS_norm + WEIGHT_TEXT_HAMD * HAMD_norm
    """
    正常-轻度:53*0.4 + 13.5*0.6 = 21.2 + 8.1 = 29.3 ≈ 30分
    轻度-中度:63*0.4 + 34.6*0.6 = 25.2 + 20.76 = 45.96 ≈ 46分
    中度-重度:73*0.4 + 46.2*0.6 = 29.2 + 27.72 = 56.92 ≈ 57分 设置高阈值保证重度判定特异性
    """
    #以下AI辅助生成：DeepSeek-R1, 2026.4.13
    if total_norm <= 30:
        level = "正常/无抑郁"
        advice = "评估结果正常，保持健康生活。"
    elif total_norm <= 46:
        level = "轻度抑郁"
        advice = "可能存在轻度抑郁，建议关注情绪变化，可尝试心理咨询。"
    elif total_norm <= 57:
        level = "中度抑郁"
        advice = "中度抑郁倾向，建议前往精神心理科进一步评估。"
    else:
        level = "重度抑郁"
        advice = "重度抑郁倾向，请尽快就医。"   
    #以上AI辅助生成：DeepSeek-R1, 2026.4.13
    
    return {
        "total_score" : round(total_norm,1),
        "SDS_contribution": round(SDS_norm * WEIGHT_VOICE_SDS, 1),
        "HAMD_contribution": round(HAMD_norm * WEIGHT_TEXT_HAMD, 1),
        "depression_level" : level,
        "advice" : advice,
    }
    
def generate_detailed_advice(hamd_scores, sds_score, hamd_total, level):
    """
    根据 HAMD 各因子分数生成针对性建议列表
    """
    
    if not hamd_scores or len(hamd_scores) != 17:
        return []
    
    suggestions = []
    for idx, score in enumerate(hamd_scores):
        factor_name = ITEM_NAMES[idx]
        mapping = HAMD_ADVICE_MAP.get(factor_name)
        if mapping and mapping["trigger"](score):
            suggestions.append({
                "factor": factor_name,
                "score": score,
                "description": mapping["desc"],
                "advice": mapping["advice"]
            })
    
    # 添加整体建议
    if level == "重度抑郁" or hamd_total >= 25:
        suggestions.append({
            "factor": "整体评估",
            "score": hamd_total,
            "description": "抑郁程度严重",
            "advice": "请尽快前往精神心理科就诊，可能需要药物或心理治疗。不要独自承受。"
        })
    elif level == "中度抑郁":
        suggestions.append({
            "factor": "整体评估",
            "score": hamd_total,
            "description": "中度抑郁倾向",
            "advice": "建议预约心理医生或心理咨询师，同时可配合自助调节方法。"
        })
    
    return suggestions  
        
