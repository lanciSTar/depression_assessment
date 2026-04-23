# 加载 SDS 分数预测模型
"""加载SDS预测模型"""

import numpy as np
import joblib
from app.config import SDS_MODEL_PATH,SDS_SCALER_PATH   

sds_model = None
sds_scaler = None


def load_sds_model():
    global sds_model, sds_scaler
    if sds_model is None:
        sds_model = joblib.load(SDS_MODEL_PATH)
        sds_scaler = joblib.load(SDS_SCALER_PATH)
        
        
    return sds_model,sds_scaler