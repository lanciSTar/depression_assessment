# 声文智诊——基于多模态的抑郁倾向量化筛查与智能交互系统

## 项目简介

本系统是一款基于 **语音 + 文本多模态分析** 的抑郁程度智能评估工具，旨在为医疗机构、心理咨询中心或社区健康服务提供 **诊前分诊参考**。系统通过分析用户的自由语音回答（约 1-3 分钟），自动提取语音特征（SDS 分数）与文本语义（HAMD-17 项评分），融合加权后输出抑郁等级和针对性建议。

> **重要提示**  
> 本系统评估结果仅供临床参考，**不能替代专业医疗诊断**。如您或他人存在严重情绪困扰，请及时寻求精神科医生或心理治疗师的帮助。

---

## 系统目标

- **快速筛查**：用户仅需录制一段自由陈述，系统自动完成分析。
- **多模态融合**：结合语音声学特征（SDS 自评）与文本语义特征（HAMD 他评），提高评估准确性。
- **交互式对话**：内置 AI 助手，可主动询问患者近况，补充评估所需信息。
- **数据管理与导出**：支持评估记录保存、管理员后台管理、报告导出为 PDF。

---

## 技术架构

| 模块 | 技术栈 |
|-------|--------|
| 后端框架 | FastAPI（Python） |
| 语音识别 | SenseVoiceSmall（FunASR） |
| 文本评分 | Qwen2.5-7B + LoRA 微调（HAMD-17） |
| 语音特征回归 | 预训练 SDS 回归模型 |
| 对话生成 | Qwen2.5-7B 基座 |
| 前端 | HTML5 / CSS3 / JavaScript（原生） |
| 数据库 | SQLite |
| 部署 | Docker / 传统服务器 |

---

## 主要功能

### 1. 患者端

- **患者信息登记**：每次使用需填写姓名、年龄、性别（强制新会话）。
- **音频采集**：支持上传本地音频文件或实时录音（WebM/MP3/WAV）。
- **智能分析**：
  - 语音转文字（ASR）
  - SDS 语音抑郁自评分数（0~100）
  - HAMD-17 项因子评分及总分（0~52）
  - 加权综合得分（SDS 30% + HAMD 70%）
- **评估报告**：
  - 显示综合得分、抑郁等级、初步建议
  - 展示 HAMD 17 项详细因子得分及因子名称
  - 根据高分因子自动生成**针对性行动建议**（如睡眠问题 → 固定作息）
- **交互对话**：与 AI 助手自由对话，系统自动记录对话历史，辅助收集症状信息。
- **报告导出**：一键导出为 PDF（通过浏览器打印功能），包含所有评分和建议。

### 2. 管理员端

- **登录认证**：默认账号 `admin` / `admin123`
- **评估记录管理**：查看、编辑、删除所有患者的评估结果
- **对话详情查看**：查看患者与 AI 助手的完整对话历史

---

## 快速开始

### 环境要求

- Python 3.10+
- CUDA 11.7+（推荐，支持 GPU 加速）
- 至少 16GB 显存（用于 Qwen-7B 模型）

### 安装步骤

1. **克隆仓库**

   ```bash
   git clone https://github.com/your-repo/depression-assessment.git
   cd depression-assessment
   ```

2. **安装依赖**

   ```bash
   pip install -r requirements.txt
   ```

3. **启动服务**

   ```bash
   python run.py
   # 或直接
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

    运行run.py文件时自动下载模型文件到`depression_assessment\models_cache`

4. **访问系统**
   - 患者端：`http://localhost:8000`
   - 管理员后台：`http://localhost:8000/admin`

---

## 项目结构

```

depression_assessment/
├── app/
│   ├── main.py                 # FastAPI 主应用
│   ├── config.py               # 配置文件
│   ├── database.py             # SQLite 数据库操作
│   ├── models/                 # 模型加载模块（单例）
│   │   ├── hamd_model.py       # HAMD 评分模型（Qwen+LoRA）
│   │   ├── asr_model.py        # SenseVoiceSmall ASR
│   │   ├── sds_model.py        # SDS 回归模型
│   │   └── model_chat.py       # 对话模型（基座 Qwen）
│   ├── services/               # 业务逻辑
│   │   ├── audio_processor.py  # 音频处理、SDS、ASR
│   │   ├── text_processor.py   # HAMD 文本评分
│   │   ├── evaluator.py        # 多模态融合 + 详细建议生成
│   │   └── model_chat.py       # 对话生成
│   └── static/                 # 前端静态文件
│       ├── index.html          # 患者评估界面
│       ├── admin.html          # 管理后台
│       ├── style.css
│       └── script.js
├── models_cache/               # 模型文件（挂载）
├── data/                       # SQLite 数据库
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── run.py
└── README.md
```

---

## 配置说明

编辑 `app/config.py` 可调整以下参数：

- `WEIGHT_VOICE_SDS` / `WEIGHT_TEXT_HAMD`：综合得分权重
- `HAMD_LEVELS` / `SDS_LEVELS`：分级阈值
- `API_HOST` / `API_PORT`：服务监听地址
- `MAX_AUDIO_SIZE_MB`：上传音频大小限制

---

## 评分标准

### 综合得分（0~100）

- **0–25**：正常 / 无抑郁
- **26-43**：轻度抑郁
- **44-54**：中度抑郁
- **55–100**：重度抑郁

### HAMD-17 总分（0~52）

- ≤7：正常
- 8–17：轻度抑郁
- 18–24：中度抑郁
- ≥25：重度抑郁

### SDS 原始分（0~100）

- <53：无抑郁
- 53–62：轻度抑郁
- 63–72：中度抑郁
- ≥73：重度抑郁
  
---

## 示例报告（PDF 导出内容）

- 综合评估结果（得分、等级、初步建议）
- 针对性行动建议（基于 HAMD 高分因子）
- HAMD-17 详细因子得分表
- 语音转写文本

---

## 后续改进方向

- [ ] 增加面部表情分析（视频模态）
- [ ] 支持多语言（英语、粤语）
- [ ] 实时流式语音分析
- [ ] 部署到云端（阿里云/腾讯云）
- [ ] 患者历史趋势图表

---

## 许可证

本项目仅供学术研究和非商业用途。模型权重归原版权方所有。
