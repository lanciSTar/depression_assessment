
import os
import json
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Depends
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBasic, HTTPBasicCredentials
import librosa
import numpy as np
import uvicorn

from app.services.audio_processor import sds_score, transcribe_audio
from app.services.text_processor import predict_row_score, hamd_scores
from app.services.evaluator import evaluate,generate_detailed_advice
from app.config import  TEMP_FILE_PREFIX, BASE_DIR, DB_PATH
from app.database import get_db_connection, init_db
from app.services.model_chat import generate_reply

# 初始化数据库
init_db()

app = FastAPI(title="抑郁程度多模态评估系统", description="诊前分诊工具")

# 静态文件
static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
else:
    static_dir.mkdir(exist_ok=True)

security = HTTPBasic()

# ---------- 患者端 API ----------
@app.post("/api/start_assessment")
async def start_assessment(
    patient_name: str = Form(...),
    patient_age: int = Form(...),
    patient_gender: str = Form(...)
):
    """第一步：创建评估记录，返回 assessment_id"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO assessments (patient_name, patient_age, patient_gender, fixed_question)
        VALUES (?, ?, ?, ?)
    ''', (patient_name, patient_age, patient_gender, "请讲述一下您最近两周的心情和生活情况"))
    assessment_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return JSONResponse({"assessment_id": assessment_id})

@app.post("/api/submit_audio")
async def submit_audio(
    assessment_id: int = Form(...),
    audio: UploadFile = File(...)
):
    """第二步：上传音频，进行预测并保存结果"""
    content = await audio.read()
    suffix = Path(audio.filename).suffix or ".wav" # type: ignore
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, prefix=TEMP_FILE_PREFIX) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        y, sr = librosa.load(tmp_path, sr=None)
        audio_tuple = (sr, y)

        sds_raw = sds_score(audio_tuple)

        text = transcribe_audio(tmp_path)

        hamd_raw_str = predict_row_score(text)
        hamd_scores_list, hamd_total, hamd_level = hamd_scores(hamd_raw_str)
        if hamd_scores_list is None:
            raise HTTPException(status_code=500, detail="HAMD 评分解析失败 时间过短或者信息过少")

        eval_result = evaluate(sds_raw, hamd_total)

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE assessments SET
                audio_file_path = ?,
                transcribed_text = ?,
                sds_raw_score = ?,
                hamd_scores = ?,
                hamd_total = ?,
                weighted_score = ?,
                depression_level = ?,
                advice = ?
            WHERE id = ?
        ''', (
            tmp_path,
            text,
            sds_raw,
            json.dumps(hamd_scores_list),
            hamd_total,
            eval_result["total_score"],
            eval_result["depression_level"],
            eval_result["advice"],
            assessment_id
        ))
        conn.commit()
        conn.close()
        
        detailed_advice = generate_detailed_advice(hamd_scores_list,sds_raw,hamd_total,eval_result["depression_level"])

        return JSONResponse({
            "assessment_id": assessment_id,
            "sds_raw": sds_raw,
            "hamd_scores": hamd_scores_list,
            "hamd_total": hamd_total,
            "hamd_level": hamd_level,
            "weighted_score": eval_result["total_score"],
            "depression_level": eval_result["depression_level"],
            "advice": eval_result["advice"],
            "transcribed_text": text,
            "detailed_advice": detailed_advice
        })
    except Exception as e:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise HTTPException(status_code=500, detail=str(e))

# ---------- 对话 API ----------
@app.post("/api/chat")
async def chat(
    assessment_id: int = Form(...),
    message: str = Form(...)
):
    """对话接口，保存用户消息和AI回复到数据库"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    #保存用户消息
    cursor.execute('''
        INSERT INTO chat_messages (assessment_id, role, message)
        VALUES (?, ?, ?)
    ''', (assessment_id, 'user', message))
    conn.commit()
    
    # 获取最近10条对话历史（用于上下文）
    cursor.execute('''
        SELECT role, message FROM chat_messages
        WHERE assessment_id = ? ORDER BY created_at DESC LIMIT 10
    ''', (assessment_id,))
    rows = cursor.fetchall()
    history = []
    for row in reversed(rows):  # 按时间正序
        history.append({"role": row["role"], "content": row["message"]})
    
    # 生成回复（传入历史）
    reply = generate_reply(message, history)
 
    
    cursor.execute('''
        INSERT INTO chat_messages (assessment_id, role, message)
        VALUES (?, ?, ?)
    ''', (assessment_id, 'assistant', reply))
    conn.commit()
    conn.close()

    return JSONResponse({"reply": reply})

@app.get("/api/chat_history/{assessment_id}")
async def get_chat_history(assessment_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT role, message, created_at FROM chat_messages
        WHERE assessment_id = ? ORDER BY created_at
    ''', (assessment_id,))
    rows = cursor.fetchall()
    conn.close()
    return JSONResponse([dict(row) for row in rows])

@app.post("/api/check_history")
async def check_history(
    patient_name: str = Form(...),
    patient_age: int = Form(...),
    patient_gender: str = Form(...)
):
    """根据患者信息查询最近一次评估结果"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM assessments 
        WHERE patient_name = ? AND patient_age = ? AND patient_gender = ?
        ORDER BY created_at DESC LIMIT 1
    ''', (patient_name, patient_age, patient_gender))
    row = cursor.fetchone()
    conn.close()
    if row:
        result = dict(row)
        if result.get('hamd_scores'):
            result['hamd_scores'] = json.loads(result['hamd_scores'])
        else:
            result['hamd_scores'] = []
        return JSONResponse({"has_history": True, "data": result})
    else:
        return JSONResponse({"has_history": False})
# ---------- 管理端 API ----------
@app.post("/api/admin/login")
async def admin_login(credentials: HTTPBasicCredentials = Depends(security)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM admin_users WHERE username = ? AND password = ?",
                   (credentials.username, credentials.password))
    user = cursor.fetchone()
    conn.close()
    if user:
        return JSONResponse({"success": True})
    else:
        raise HTTPException(status_code=401, detail="用户名或密码错误")

@app.get("/api/admin/assessments")
async def get_all_assessments():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT a.*, COUNT(c.id) as chat_count
        FROM assessments a
        LEFT JOIN chat_messages c ON a.id = c.assessment_id
        GROUP BY a.id
        ORDER BY a.created_at DESC
    ''')
    rows = cursor.fetchall()
    result = []
    for row in rows:
        d = dict(row)
        if d.get('hamd_scores'):
            d['hamd_scores'] = json.loads(d['hamd_scores'])
        else:
            d['hamd_scores'] = []
        result.append(d)
    conn.close()
    return JSONResponse(result)

@app.put("/api/admin/assessment/{assessment_id}")
async def update_assessment(assessment_id: int, data: dict):
    allowed_fields = ['patient_name', 'patient_age', 'patient_gender', 'depression_level', 'advice']
    updates = {k: v for k, v in data.items() if k in allowed_fields}
    if not updates:
        raise HTTPException(status_code=400, detail="无有效字段")
    set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
    values = list(updates.values()) + [assessment_id]
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(f"UPDATE assessments SET {set_clause} WHERE id = ?", values)
    conn.commit()
    conn.close()
    return JSONResponse({"success": True})

@app.delete("/api/admin/assessment/{assessment_id}")
async def delete_assessment(assessment_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT audio_file_path FROM assessments WHERE id = ?", (assessment_id,))
    row = cursor.fetchone()
    if row and row['audio_file_path'] and os.path.exists(row['audio_file_path']):
        os.unlink(row['audio_file_path'])
    cursor.execute("DELETE FROM chat_messages WHERE assessment_id = ?", (assessment_id,))
    cursor.execute("DELETE FROM assessments WHERE id = ?", (assessment_id,))
    conn.commit()
    conn.close()
    return JSONResponse({"success": True})

# ---------- 原有页面路由 ----------
@app.get("/")
async def root():
    index_path = static_dir / "index.html"
    with open(index_path, "r", encoding="utf-8") as f:
        html_content = f.read()
    return HTMLResponse(content=html_content)

@app.get("/admin")
async def admin_page():
    admin_path = static_dir / "admin.html"
    if not admin_path.exists():
        return HTMLResponse("<h1>管理员页面未找到，请创建 admin.html</h1>")
    with open(admin_path, "r", encoding="utf-8") as f:
        html_content = f.read()
    return HTMLResponse(content=html_content)

@app.post("/predict")   # 保留原接口兼容
async def predict(audio: UploadFile = File(...)):
    content = await audio.read()
    suffix = Path(audio.filename).suffix or ".wav" # type: ignore
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, prefix=TEMP_FILE_PREFIX) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    try:
        y, sr = librosa.load(tmp_path, sr=None)
        audio_tuple = (sr, y)
        sds_raw = sds_score(audio_tuple)
        text = transcribe_audio(tmp_path)
        hamd_raw_str = predict_row_score(text)
        hamd_scores_list, hamd_total, hamd_level = hamd_scores(hamd_raw_str)
        if hamd_scores_list is None:
            raise HTTPException(status_code=500, detail="HAMD 评分解析失败 时间过短或者信息过少")
        eval_result = evaluate(sds_raw, hamd_total)
        result = {
            "transcribed_text": text,
            "sds_raw": sds_raw,
            "hamd_scores": hamd_scores_list,
            "hamd_total": hamd_total,
            "hamd_level": hamd_level,
            "weighted_score": eval_result["total_score"],
            "depression_level": eval_result["depression_level"],
            "advice": eval_result["advice"]
        }
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app="app.main:app", reload=True)