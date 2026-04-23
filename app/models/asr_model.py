# 加载 SenseVoiceSmall ASR 模型
"""加载语音转文字模型"""

import os
from funasr import AutoModel
from app.config import ASR_MODEL_PATH,ASR_LANGUAGE,ASR_DEVICE

asr_model = None
local_path = ASR_MODEL_PATH
model_path = local_path if os.path.exists(local_path) else "iic/SenseVoiceSmall"


def load_asr_model():
    global asr_model
    if asr_model is None:
        
       asr_model = AutoModel(
            model = model_path,
            trust_remote_code = True,
            model_revision="master",
            device = ASR_DEVICE,
            disable_update =True,
            offline = True,
            language = ASR_LANGUAGE,
        )
    return asr_model

if __name__ == "__main__":
    load_asr_model()