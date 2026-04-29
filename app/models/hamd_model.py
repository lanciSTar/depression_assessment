# 加载 Qwen+LoRA，提供 HAMD-17 评分

"""加载HAMD预测模型"""
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel
from app.config import HAMD_BASE_MODEL,HAMD_LORA_PATH,ITEM_NAMES

# ---------------------- 配置-----------------------
BASE_MODEL = HAMD_BASE_MODEL
LORA_PATH = HAMD_LORA_PATH


#---------------加载模型---------------------
tokenizer = None
model = None 
def load_hamd_model():
    global tokenizer, model
    if model is None:
        tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
        base_model = AutoModelForCausalLM.from_pretrained(
            BASE_MODEL, 
            dtype=torch.bfloat16, 
            device_map="cuda",    
            low_cpu_mem_usage=True, #如果显存不足，可以设置为 True 来降低 CPU 内存占用，但会增加加载时间
        )
        model = PeftModel.from_pretrained(base_model, LORA_PATH)
        model.eval()
    return tokenizer,model
