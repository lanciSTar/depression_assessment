 # 音频格式转换、特征提取 预测SDS分数
"""音频格式转换、特征提取 预测SDS分数"""
import re
import librosa
import numpy as np
import soundfile
import os
from app.models.asr_model import load_asr_model
from app.models.sds_model import load_sds_model

#-------------------音频转文字-----------------
def transcribe_audio(audio_path: str) -> str:    # AI辅助生成：DeepSeek-R1, 2026.4.13
    model = load_asr_model()
    result = model.generate(input=audio_path, language="zh")
    raw_text = result[0]["text"]
    
    return re.sub(r"<.*?>", '', raw_text)


#-------------------特征提取----------------
#提取音频特征值
def extract_feature(file_path):
    
    y,sr = librosa.load(file_path,sr=16000)
    y = librosa.effects.preemphasis(y)
    y,_ = librosa.effects.trim(y)
    mfcc = librosa.feature.mfcc(y=y,sr=sr,n_mfcc=13)
    delta1 = librosa.feature.delta(mfcc)
    delta2 = librosa.feature.delta(mfcc,order=2)
    feature = np.concatenate([mfcc,delta1,delta2],axis=0)
    feature_mean = np.mean(feature,axis=1)
    return feature_mean



#预测SDS分数 判断抑郁程度 返回权重
def sds_score(audio):
    """预测SDS分数"""
    model = load_sds_model()[0]
    scaler = load_sds_model()[1]
    
    sr_record,y_record = audio
    y = y_record.astype(np.float32) / 32768.0
    y = librosa.resample(y, orig_sr=sr_record,target_sr=16000)
    soundfile.write("temp.wav",y,16000)
    feature = extract_feature("temp.wav")
    feature = feature.reshape(1,-1)
    feature_scaled = scaler.transform(feature) #type: ignore
    score = model.predict(feature_scaled)[0]
    score = round(score) # 取整数
    total_score = 0
    # 53 53-62 63-72 73
    if score<53:#无
        total_score = 0
    elif score<=62: #轻度
        total_score = 1
    elif score<=72: #中度
        total_score = 2
    elif score>73: #重度
        total_score = 3
    if os.path.exists("temp.wav"):
        os.remove("temp.wav")
        
    return score