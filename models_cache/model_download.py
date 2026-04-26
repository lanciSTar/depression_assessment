import os
from modelscope import snapshot_download

current_dir = os.path.dirname(__file__)

Qwen = os.path.join(current_dir,  "Qwen","Qwen2.5-7B-Instruct")
SenseVoiceSmall = os.path.join(current_dir,  "iic","SenseVoiceSmall")

os.makedirs(Qwen,exist_ok=True)
os.makedirs(SenseVoiceSmall,exist_ok=True)



"""检查是否下载"""
if os.path.exists(os.path.join(Qwen,"config.json")) and os.path.exists(os.path.join(Qwen,"model-00004-of-00004.safetensors")):
    print("Qwen模型已存在")
else:
    print("Qwen模型不存在，开始下载")
    model_1 = snapshot_download(
        "Qwen/Qwen2.5-7B-Instruct",
        Qwen,
    )
    
    
    
if os.path.exists(os.path.join(SenseVoiceSmall,"model.pt")) and os.path.exists(os.path.join(SenseVoiceSmall,"tokens.json")):
    print("SenseVoiceSmall已存在")
else:
    print("SenseVoiceSmall不存在，开始下载")
    model_2 = snapshot_download(
        "iic/SenseVoiceSmall",
        cache_dir=SenseVoiceSmall
    )
