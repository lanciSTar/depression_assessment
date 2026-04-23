
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from app.config import HAMD_BASE_MODEL
from app.models.hamd_model import load_hamd_model


def generate_reply(message: str,conversation_history: list = None ) -> str:
    """根据用户消息生成 AI 回复
    根据用户消息生成 AI 回复，主动收集抑郁相关症状信息。
    conversation_history: 可选的历史对话列表，每条为
    {'role': 'user'/'assistant', 'content': str}"""
    tokenizer, model = load_hamd_model()
    system_prompt = """你是一位专业的心理评估助手。你的目标是通过对话收集患者近两周的抑郁相关症状信息，包括：
1. 情绪状态（低落、无助、易哭等）
2. 兴趣丧失（对以前喜欢的事情是否还感兴趣）
3. 睡眠问题（入睡困难、睡眠浅、早醒）
4. 精力变化（疲劳、乏力）
5. 食欲和体重变化
6. 自我评价（无用感、自责）
7. 注意力和决策能力
8. 精神运动性改变（烦躁或迟缓）
9. 自杀意念（是否有活着没意思、想结束生命的想法）

请用温和、共情的语气提问，每次只问1-2个问题，避免一次性问太多。根据患者的回答，自然地追问细节，并适时给予支持和正常化反馈。不要直接给出医学诊断，但可以建议进一步专业评估。

如果患者已经提供了某些信息，就不要再重复询问。对话要自然流畅，像真实医生问诊一样。
"""
    prompt = f"<|im_start|>system\n{system_prompt}<|im_end|>\n"
    if conversation_history:
        for turn in conversation_history[-6:]:  # 保留最近6轮
            role = "user" if turn['role'] == 'user' else "assistant"
            prompt += f"<|im_start|>{role}\n{turn['content']}<|im_end|>\n"
    prompt += f"<|im_start|>user\n{message}<|im_end|>\n<|im_start|>assistant\n"
    
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=256,
            temperature=0.7,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id
        )
    reply = tokenizer.decode(outputs[0], skip_special_tokens=True).split("assistant")[-1].strip()
    
    # 如果回复为空，给出默认提示
    if not reply:
        reply = "我在这里陪着你。可以再多说说您最近的心情或睡眠情况吗？"
    return reply