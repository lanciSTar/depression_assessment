// 全局变量
let currentAssessmentId = null;
let mediaRecorder = null;
let audioChunks = [];
let audioBlob = null;
let audioUrl = null;
let timerInterval = null;
let seconds = 0;
let currentMode = 'upload';
let currentResultData = null; // 存储最近一次评估结果

// HAMD 17项因子名称（与后端保持一致）
const HAMD_ITEM_NAMES = [
    "抑郁情绪", "有罪感", "自杀观念",
    "入睡困难", "睡眠不深", "早醒",
    "工作和兴趣", "迟缓", "激越",
    "精神性焦虑", "躯体性焦虑",
    "胃肠道症状", "全身症状", "生殖系统症状",
    "疑病", "体重减轻", "自知力"
];

// DOM 元素
const startRecordBtn = document.getElementById('startRecordBtn');
const stopRecordBtn = document.getElementById('stopRecordBtn');
const playRecordBtn = document.getElementById('playRecordBtn');
const audioPreview = document.getElementById('audioPreview');
const audioPreviewContainer = document.getElementById('audioPreviewContainer');
const recordingStatus = document.getElementById('recordingStatus');
const timeDisplay = document.getElementById('timeDisplay');
const audioInput = document.getElementById('audioInput');
const uploadBtn = document.getElementById('uploadBtn');
const analyzeRecordBtn = document.getElementById('analyzeRecordBtn');
const fileName = document.getElementById('fileName');
const modeOptions = document.querySelectorAll('.mode-option');
const uploadMode = document.getElementById('uploadMode');
const recordMode = document.getElementById('recordMode');

// 患者信息模态框元素
let infoModal, saveInfoBtn, patientName, patientAge, patientGender, mainContent;

// 聊天相关元素
let chatArea, chatMessages, chatInput, sendChatBtn;

// ==================== 患者信息模态框逻辑 ====================

function showModalBlocking() {
    if (!infoModal || !mainContent) return;
    infoModal.style.display = 'flex';
    mainContent.classList.add('hidden');
    document.body.style.overflow = 'hidden';
    // 阻止点击背景关闭
    infoModal.addEventListener('click', function(e) {
        if (e.target === infoModal) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);
    setTimeout(() => { if (patientName) patientName.focus(); }, 100);
}

function hideModalAndShowMain() {
    if (!infoModal || !mainContent) return;
    infoModal.style.display = 'none';
    mainContent.classList.remove('hidden');
    document.body.style.overflow = '';
}

async function savePatientInfo() {
    if (!patientName || !patientAge || !patientGender) return;
    const name = patientName.value.trim();
    const age = patientAge.value.trim();
    const gender = patientGender.value;

    if (!name) { alert('请输入患者姓名'); patientName.focus(); return false; }
    if (!age) { alert('请输入患者年龄'); patientAge.focus(); return false; }
    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) { alert('请输入有效的年龄（1-120岁）'); patientAge.focus(); return false; }
    if (!gender) { alert('请选择患者性别'); patientGender.focus(); return false; }

    try {
        // ✅ 第一步：查询历史评估
        const historyCheck = await fetch('/api/check_history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                patient_name: name,
                patient_age: ageNum,
                patient_gender: gender
            })
        });
        const historyData = await historyCheck.json();

        if (historyData.has_history) {
            const useHistory = confirm('检测到您之前有评估记录，是否查看上次的结果？\n（点击“确定”查看历史结果，点击“取消”进行新的评估）');
            if (useHistory) {
                // 加载历史数据并显示
                const oldResult = historyData.data;
                const fakeResult = {
                    weighted_score: oldResult.weighted_score,
                    depression_level: oldResult.depression_level,
                    advice: oldResult.advice,
                    sds_raw: oldResult.sds_raw_score,
                    hamd_total: oldResult.hamd_total,
                    hamd_level: oldResult.depression_level,
                    transcribed_text: oldResult.transcribed_text,
                    hamd_scores: oldResult.hamd_scores,
                    detailed_advice: oldResult.detailed_advice || []
                };
                if (!fakeResult.detailed_advice || fakeResult.detailed_advice.length === 0) {
                    fakeResult.detailed_advice = [];
                }
                currentResultData = fakeResult;
                displayResult(fakeResult);
                currentAssessmentId = oldResult.id;
                localStorage.setItem('currentAssessmentId', currentAssessmentId);
                hideModalAndShowMain();
                await loadChatHistory();
                return;
            }
        }

        // ✅ 第二步：无历史或用户选择新评估 → 创建新评估记录
        const formData = new FormData();
        formData.append('patient_name', name);
        formData.append('patient_age', ageNum);
        formData.append('patient_gender', gender);

        const response = await fetch('/api/start_assessment', { method: 'POST', body: formData });
        const data = await response.json();
        if (data.assessment_id) {
            currentAssessmentId = data.assessment_id;
            localStorage.setItem('currentAssessmentId', currentAssessmentId);
            hideModalAndShowMain();
        } else {
            alert('启动评估失败，请重试');
        }
    } catch (err) {
        console.error(err);
        alert('网络错误：' + err.message);
    }
}

// ==================== 聊天功能 ====================
async function loadChatHistory() {
    if (!currentAssessmentId) return;
    try {
        const response = await fetch(`/api/chat_history/${currentAssessmentId}`);
        if (!response.ok) throw new Error('加载历史失败');
        const messages = await response.json();
        if (chatMessages) {
            chatMessages.innerHTML = '';
            for (let msg of messages) {
                appendChatMessage(msg.role, msg.message);
            }
        }
    } catch (err) {
        console.error(err);
    }
}

function appendChatMessage(role, message) {
    if (!chatMessages) return;
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;
    // 头像
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
    // 气泡
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = message;
    if (role === 'user') {
        messageDiv.appendChild(bubble);
        messageDiv.appendChild(avatar);
    } else {
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(bubble)

    }
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendChatMessage() {
    if (!chatInput) return;
    const message = chatInput.value.trim();
    if (!message || !currentAssessmentId) return;
    chatInput.value = '';
    appendChatMessage('user', message);

    const formData = new FormData();
    formData.append('assessment_id', currentAssessmentId);
    formData.append('message', message);
    try {
        const response = await fetch('/api/chat', { method: 'POST', body: formData });
        if (!response.ok) throw new Error('发送失败');
        const data = await response.json();
        appendChatMessage('assistant', data.reply);
    } catch (err) {
        console.error(err);
        appendChatMessage('assistant', '抱歉，AI暂时无法回复，请稍后重试。');
    }
}

// ==================== 音频分析（使用新接口） ====================
// 显示评估结果到页面（供新评估和历史记录复用）
function displayResult(data) {
    document.getElementById('compScore').innerText = data.weighted_score || '--';
    document.getElementById('level').innerText = data.depression_level || '--';
    document.getElementById('advice').innerText = data.advice || '--';
    document.getElementById('sdsRaw').innerText = data.sds_raw || '--';
    document.getElementById('hamdTotal').innerText = data.hamd_total || '--';
    document.getElementById('hamdLevel').innerText = data.hamd_level || '--';
    document.getElementById('text').innerText = data.transcribed_text || '无录音内容';

    // 等级徽章颜色
    const levelBadge = document.getElementById('levelBadge');
    levelBadge.textContent = data.depression_level || '--';
    const level = (data.depression_level || '').toLowerCase();
    if (level.includes('无抑郁') || level.includes('正常')) {
        levelBadge.style.background = 'linear-gradient(135deg, #2ecc71, #27ae60)';
    } else if (level.includes('轻度')) {
        levelBadge.style.background = 'linear-gradient(135deg, #f1c40f, #f39c12)';
    } else if (level.includes('中度')) {
        levelBadge.style.background = 'linear-gradient(135deg, #e67e22, #d35400)';
    } else if (level.includes('重度')) {
        levelBadge.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
    }

    // 渲染 HAMD 17项
    const hamdScoresList = document.getElementById('hamdScoresList');
    hamdScoresList.innerHTML = '';
    if (data.hamd_scores && Array.isArray(data.hamd_scores) && data.hamd_scores.length === 17) {
        data.hamd_scores.forEach((score, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'hamd-item';
            const nameSpan = document.createElement('div');
            nameSpan.className = 'hamd-name';
            nameSpan.textContent = HAMD_ITEM_NAMES[index];
            const scoreSpan = document.createElement('div');
            scoreSpan.className = 'hamd-score';
            scoreSpan.textContent = `${score}分`;
            if (score >= 3) scoreSpan.style.color = '#e74c3c';
            else if (score >= 2) scoreSpan.style.color = '#f39c12';
            else scoreSpan.style.color = '#2ecc71';
            itemDiv.appendChild(nameSpan);
            itemDiv.appendChild(scoreSpan);
            hamdScoresList.appendChild(itemDiv);
        });
    } else {
        hamdScoresList.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:20px;">HAMD评分数据不完整</div>';
    }

    // 显示结果区域，隐藏加载，显示聊天区
    document.getElementById('result').classList.remove('hidden');
    document.getElementById('loading').classList.add('hidden');
    if (chatArea) chatArea.classList.remove('hidden');
}

async function analyzeAudio(audioFile) {
    if (!currentAssessmentId) {
        alert('请先填写患者信息');
        return;
    }
    
    

    // 显示加载动画，隐藏结果和聊天区
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('result').classList.add('hidden');
    if (chatArea) chatArea.classList.add('hidden');
    document.getElementById('error').classList.add('hidden');

    // 设置报告时间
    const now = new Date();
    const timeString = now.toLocaleString('zh-CN', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    document.getElementById('reportTime').textContent = `报告生成时间: ${timeString}`;

    const formData = new FormData();
    formData.append('assessment_id', currentAssessmentId);
    formData.append('audio', audioFile);

    try {
        const response = await fetch('/api/submit_audio', { method: 'POST', body: formData });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`服务器错误 (${response.status}): ${errorText}`);
        }
        const data = await response.json();
        
        currentResultData = data;
        
        // 填充综合结果
        document.getElementById('compScore').innerText = data.weighted_score || '--';
        document.getElementById('level').innerText = data.depression_level || '--';
        document.getElementById('advice').innerText = data.advice || '--';
        document.getElementById('sdsRaw').innerText = data.sds_raw || '--';
        document.getElementById('hamdTotal').innerText = data.hamd_total || '--';
        document.getElementById('hamdLevel').innerText = data.hamd_level || '--';
        document.getElementById('text').innerText = data.transcribed_text || '无录音内容';

        // 等级徽章颜色
        const levelBadge = document.getElementById('levelBadge');
        levelBadge.textContent = data.depression_level || '--';
        const level = (data.depression_level || '').toLowerCase();
        if (level.includes('无抑郁') || level.includes('正常')) {
            levelBadge.style.background = 'linear-gradient(135deg, #2ecc71, #27ae60)';
        } else if (level.includes('轻度')) {
            levelBadge.style.background = 'linear-gradient(135deg, #f1c40f, #f39c12)';
        } else if (level.includes('中度')) {
            levelBadge.style.background = 'linear-gradient(135deg, #e67e22, #d35400)';
        } else if (level.includes('重度')) {
            levelBadge.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
        }

        // 渲染 HAMD 17项（带因子名称）
        const hamdScoresList = document.getElementById('hamdScoresList');
        hamdScoresList.innerHTML = '';
        if (data.hamd_scores && Array.isArray(data.hamd_scores) && data.hamd_scores.length === 17) {
            data.hamd_scores.forEach((score, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'hamd-item';
                const nameSpan = document.createElement('div');
                nameSpan.className = 'hamd-name';
                nameSpan.textContent = HAMD_ITEM_NAMES[index];
                const scoreSpan = document.createElement('div');
                scoreSpan.className = 'hamd-score';
                scoreSpan.textContent = `${score}分`;
                if (score >= 3) scoreSpan.style.color = '#e74c3c';
                else if (score >= 2) scoreSpan.style.color = '#f39c12';
                else scoreSpan.style.color = '#2ecc71';
                itemDiv.appendChild(nameSpan);
                itemDiv.appendChild(scoreSpan);
                hamdScoresList.appendChild(itemDiv);
            });
        } else {
            hamdScoresList.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:20px;">HAMD评分数据不完整</div>';
        }

        // 显示结果，加载聊天历史
        document.getElementById('result').classList.remove('hidden');
        document.getElementById('loading').classList.add('hidden');
        if (chatArea) chatArea.classList.remove('hidden');
        await loadChatHistory();

    } catch (err) {
        console.error('分析失败:', err);
        const errorDiv = document.getElementById('error');
        const errorMessage = document.getElementById('errorMessage');
        errorMessage.textContent = `评估失败：${err.message}`;
        errorDiv.classList.remove('hidden');
        document.getElementById('loading').classList.add('hidden');
    }
}

// ==================== 原有录音和上传功能（修改后适配新API） ====================
function switchMode(mode) {
    currentMode = mode;
    modeOptions.forEach(opt => {
        if (opt.dataset.mode === mode) {
            opt.classList.add('active');
        } else {
            opt.classList.remove('active');
        }
    });
    if (mode === 'upload') {
        uploadMode.classList.add('active');
        recordMode.classList.remove('active');
    } else {
        uploadMode.classList.remove('active');
        recordMode.classList.add('active');
    }
}

modeOptions.forEach(option => {
    option.addEventListener('click', () => {
        const mode = option.dataset.mode;
        switchMode(mode);
    });
});

audioInput.addEventListener('change', (e) => {
    if (audioInput.files.length > 0) {
        const file = audioInput.files[0];
        fileName.textContent = `${file.name} (${formatFileSize(file.size)})`;
        clearRecordingState();
    } else {
        fileName.textContent = '未选择文件';
    }
});

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

startRecordBtn.addEventListener('click', async () => {
    try {
        if (!currentAssessmentId) {
            alert('请先填写患者信息');
            return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 44100 }
        });
        const options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = 'audio/webm';
        }
        mediaRecorder = new MediaRecorder(stream, options);
        audioChunks = [];
        seconds = 0;
        timeDisplay.textContent = '00:00';

        mediaRecorder.start(100);
        startRecordBtn.disabled = true;
        stopRecordBtn.disabled = false;
        playRecordBtn.disabled = true;
        recordingStatus.style.display = 'block';
        audioPreviewContainer.style.display = 'none';

        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
            audioUrl = URL.createObjectURL(audioBlob);
            audioPreview.src = audioUrl;
            audioPreviewContainer.style.display = 'block';
            stream.getTracks().forEach(track => track.stop());
            startRecordBtn.disabled = false;
            startRecordBtn.innerHTML = '<i class="fas fa-redo"></i> 重新录音';
            stopRecordBtn.disabled = true;
            playRecordBtn.disabled = false;
            analyzeRecordBtn.disabled = false;
            recordingStatus.style.display = 'none';
            clearInterval(timerInterval);
        };

        mediaRecorder.onerror = (event) => {
            console.error('录音错误:', event.error);
            alert('录音过程中发生错误，请重试');
            resetRecording();
        };
    } catch (error) {
        console.error(error);
        if (error.name === 'NotAllowedError') alert('麦克风权限被拒绝');
        else if (error.name === 'NotFoundError') alert('未找到麦克风设备');
        else alert('无法访问麦克风: ' + error.message);
    }
});

stopRecordBtn.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
});

playRecordBtn.addEventListener('click', () => {
    if (!audioUrl) return; //没有录音直接返回
    const audio = document.getElementById('audioPreview');
    if (audio.paused) {
        audio.play().catch(e => {
            console.error('播放失败:', e);
            resetPlayButtonToPlay();
        })
    } else {
        audio.pause();
    }
});

audioPreview.addEventListener('play', () => {
    playRecordBtn.innerHTML = '<i class="fas fa-pause"></i> 暂停';
    playRecordBtn.classList.remove('btn-play');
    playRecordBtn.classList.add('btn-stop');
    playRecordBtn.title = '暂停播放';
});
// audioPreview.addEventListener('pause', () => {
//     playRecordBtn.innerHTML = '<i class="fas fa-play"></i> 播放';
//     playRecordBtn.classList.remove('btn-stop');
//     playRecordBtn.classList.add('btn-play');
// });
// audioPreview.addEventListener('ended', () => {
//     playRecordBtn.innerHTML = '<i class="fas fa-play"></i> 播放';
//     playRecordBtn.classList.remove('btn-stop');
//     playRecordBtn.classList.add('btn-play');
// });

audioPreview.addEventListener('pause', ()=> {
    resetPlayButtonToPlay();
});

audioPreview.addEventListener('ended', () => {
    resetPlayButtonToPlay();
    audioPreview.currentTime = 0;
});

function resetPlayButtonToPlay() {
    playRecordBtn.innerHTML = '<i class="fas fa-play"></i> 播放';
    playRecordBtn.classList.remove('btn-stop');
    playRecordBtn.classList.add('btn-play');
    playRecordBtn.title = '播放录音';
}

function updateTimer() {
    seconds++;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    if (seconds >= 300) {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            alert('已达到最大录音时间（5分钟），录音已自动停止');
        }
    }
}

function resetRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
    clearInterval(timerInterval);
    startRecordBtn.disabled = false;
    startRecordBtn.innerHTML = '<i class="fas fa-circle"></i> 开始录音';
    stopRecordBtn.disabled = true;
    playRecordBtn.disabled = true;
    recordingStatus.style.display = 'none';
    audioPreviewContainer.style.display = 'none';
    analyzeRecordBtn.disabled = true;
    audioBlob = null;
    audioUrl = null;
    seconds = 0;
    timeDisplay.textContent = '00:00';
}

function clearRecordingState() {
    audioBlob = null;
    audioUrl = null;
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
    clearInterval(timerInterval);
    startRecordBtn.innerHTML = '<i class="fas fa-circle"></i> 开始录音';
    startRecordBtn.disabled = false;
    stopRecordBtn.disabled = true;
    playRecordBtn.disabled = true;
    recordingStatus.style.display = 'none';
    audioPreviewContainer.style.display = 'none';
    audioPreview.src = '';
    analyzeRecordBtn.disabled = true;
}

uploadBtn.addEventListener('click', () => {
    if (!currentAssessmentId) { alert('请先填写患者信息'); return; }
    if (audioInput.files.length > 0) {
        analyzeAudio(audioInput.files[0]);
    } else {
        alert('请先选择音频文件');
    }
});

analyzeRecordBtn.addEventListener('click', () => {
    if (!currentAssessmentId) { alert('请先填写患者信息'); return; }
    if (audioBlob) {
        const audioFile = new File([audioBlob], 'recording.webm', { type: audioBlob.type, lastModified: Date.now() });
        analyzeAudio(audioFile);
    } else {
        alert('请先进行录音');
    }
});

// 导出报告
document.getElementById('exportBtn')?.addEventListener('click', () => {
    if (!currentResultData) {
        alert('暂无评估结果可导出');
        return;
    }
    exportReportAsPDF(currentResultData);
});

// 导出报告为 PDF（通过浏览器打印）  AI辅助生成：DeepSeek, 2026-4-21
function exportReportAsPDF(data) {
    if (!data) {
        alert('暂无评估结果可导出');
        return;
    }

    const now = new Date();
    const dateStr = now.toLocaleString('zh-CN');
    const hamdScores = data.hamd_scores || [];
    const hamdNames = HAMD_ITEM_NAMES;  // 确保顶部已定义

    // 生成详细建议 HTML
    let detailedAdviceHtml = '';
    if (data.detailed_advice && data.detailed_advice.length > 0) {
        detailedAdviceHtml = '<div class="advice-section"><h3>📋 针对性行动建议</h3><ul>';
        data.detailed_advice.forEach(item => {
            detailedAdviceHtml += `
                <li>
                    <strong>${item.factor}</strong>（${item.score}分）：${item.description}<br>
                    <span class="action">👉 ${item.advice}</span>
                </li>
            `;
        });
        detailedAdviceHtml += '</ul></div>';
    } else {
        detailedAdviceHtml = '<p>暂无详细建议（因子得分未触发阈值）</p>';
    }

    // HAMD 表格
    let hamdTableHtml = '<table class="hamd-table"><thead><tr><th>因子</th><th>得分</th></tr></thead><tbody>';
    for (let i = 0; i < hamdScores.length; i++) {
        hamdTableHtml += `<tr><td>${hamdNames[i]}</td><td style="text-align:center">${hamdScores[i]}</td></tr>`;
    }
    hamdTableHtml += '</tbody></table>';

    // 完整报告 HTML
    const printHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>抑郁评估报告_${dateStr}</title>
        <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body {
                font-family: 'Microsoft YaHei', 'SimHei', 'PingFang SC', 'Helvetica Neue', Roboto, Arial, sans-serif;
                padding: 40px 30px;
                background: white;
                color: #2c3e50;
                line-height: 1.5;
            }
            .report-container { max-width: 900px; margin: 0 auto; }
            h1 { color: #3498db; font-size: 28px; border-bottom: 2px solid #3498db; padding-bottom: 12px; margin-bottom: 20px; }
            .date { text-align: right; color: #7f8c8d; margin-bottom: 30px; font-size: 14px; }
            .score-card { background: #f0f7ff; border-radius: 16px; padding: 20px; margin: 25px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
            .score-card h2 { font-size: 20px; margin-bottom: 15px; color: #2c3e50; }
            .score-grid { display: flex; flex-wrap: wrap; gap: 20px; margin-top: 15px; }
            .score-item { background: white; border-radius: 12px; padding: 12px 20px; flex: 1; min-width: 150px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .score-label { font-size: 14px; color: #7f8c8d; margin-bottom: 6px; }
            .score-value { font-size: 28px; font-weight: bold; color: #2c3e50; }
            .advice-box { background: #fef9e6; border-left: 5px solid #f39c12; padding: 15px 20px; margin: 25px 0; border-radius: 8px; }
            .advice-section { background: #f9f9f9; border-radius: 12px; padding: 18px; margin: 25px 0; }
            .advice-section h3 { margin-bottom: 15px; color: #e67e22; }
            .advice-section ul { padding-left: 20px; }
            .advice-section li { margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
            .action { color: #2980b9; font-size: 0.95em; }
            .hamd-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
            .hamd-table th, .hamd-table td { border: 1px solid #ddd; padding: 8px 10px; }
            .hamd-table th { background: #3498db; color: white; font-weight: 600; }
            .transcription { background: #f5f5f5; padding: 15px; border-radius: 10px; margin: 20px 0; font-size: 14px; line-height: 1.6; }
            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #95a5a6; border-top: 1px solid #ecf0f1; padding-top: 20px; }
            @media print {
                body { padding: 0; margin: 0.5cm; }
                .score-card, .advice-box, .advice-section { break-inside: avoid; }
            }
        </style>
    </head>
    <body>
        <div class="report-container">
            <h1>📊 抑郁程度智能评估报告</h1>
            <div class="date">生成时间：${dateStr}</div>

            <div class="score-card">
                <h2>综合评估结果</h2>
                <div class="score-grid">
                    <div class="score-item"><div class="score-label">综合得分</div><div class="score-value">${data.weighted_score ?? '--'}</div></div>
                    <div class="score-item"><div class="score-label">抑郁等级</div><div class="score-value" style="font-size:22px">${data.depression_level ?? '--'}</div></div>
                    <div class="score-item"><div class="score-label">HAMD 总分</div><div class="score-value">${data.hamd_total ?? '--'}</div></div>
                    <div class="score-item"><div class="score-label">SDS 原始分</div><div class="score-value">${data.sds_raw ?? '--'}</div></div>
                </div>
            </div>

            <div class="advice-box">
                <h3>💡 初步建议</h3>
                <p>${data.advice ?? '无'}</p>
            </div>

            ${detailedAdviceHtml}

            <h3>📋 HAMD-17 项详细评分</h3>
            ${hamdTableHtml}

            <h3>🎤 语音转写文本</h3>
            <div class="transcription">
                ${data.transcribed_text ? data.transcribed_text.replace(/\n/g, '<br>') : '无'}
            </div>

            <div class="footer">
                <p>本报告由 AI 辅助生成，仅供参考，不能替代专业医疗诊断。</p>
                <p>如果您感到情绪困扰，请及时寻求专业心理帮助。</p>
            </div>
        </div>
    </body>
    </html>
    `;

    // 打开新窗口并自动调出打印对话框（用户可选择“另存为 PDF”）
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('请允许弹出窗口，以便生成报告 PDF');
        return;
    }
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.onload = () => {
        printWindow.print();
        // 打印后不自动关闭，让用户自己关闭窗口
        printWindow.onafterprint = () => printWindow.close();
    };
}

// 新的评估
document.getElementById('newAssessmentBtn')?.addEventListener('click', () => {
    currentAssessmentId = null;
    localStorage.removeItem('currentAssessmentId');
    document.getElementById('result').classList.add('hidden');
    document.getElementById('error').classList.add('hidden');
    audioInput.value = '';
    fileName.textContent = '未选择文件';
    clearRecordingState();
    switchMode('upload');
    if (chatMessages) chatMessages.innerHTML = '';
    // 重新显示模态框
    if (infoModal && mainContent) {
        infoModal.style.display = 'flex';
        mainContent.classList.add('hidden');
        document.body.style.overflow = 'hidden';
    }
});

document.getElementById('retryBtn')?.addEventListener('click', () => {
    document.getElementById('error').classList.add('hidden');
});

window.addEventListener('beforeunload', () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    if (timerInterval) clearInterval(timerInterval);
});

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 获取元素
    infoModal = document.getElementById('infoModal');
    saveInfoBtn = document.getElementById('saveInfoBtn');
    patientName = document.getElementById('patientName');
    patientAge = document.getElementById('patientAge');
    patientGender = document.getElementById('patientGender');
    mainContent = document.getElementById('mainContent');
    chatArea = document.getElementById('chatArea');
    chatMessages = document.getElementById('chatMessages');
    chatInput = document.getElementById('chatInput');
    sendChatBtn = document.getElementById('sendChatBtn');

    if (!infoModal || !saveInfoBtn || !patientName || !patientAge || !patientGender || !mainContent) {
        console.error('缺少必要DOM元素');
        if (mainContent) mainContent.classList.remove('hidden');
    } else {
        //运用本地信息，下一次登入不用重新输入
        // const savedId = localStorage.getItem('currentAssessmentId');
        // if (savedId) {
        //     currentAssessmentId = parseInt(savedId);
        //     hideModalAndShowMain();
        //     loadChatHistory();
        // } else {
        //     showModalBlocking();
        // } 
        
        //每次进入都强制显示患者信息模态框，不自动恢复历史
        localStorage.removeItem('currentAssessmentId');
        currentAssessmentId = null;
        showModalBlocking();

        saveInfoBtn.addEventListener('click', savePatientInfo);
        patientName.addEventListener('keypress', (e) => { if (e.key === 'Enter') savePatientInfo(); });
        patientAge.addEventListener('keypress', (e) => { if (e.key === 'Enter') savePatientInfo(); });
    }

    if (sendChatBtn && chatInput) {
        sendChatBtn.addEventListener('click', sendChatMessage);
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();

            }
    })};

    let mediaRecorderVoice = null;
    let audioChunksVoice = [];
    let voiceStream = null;
    let voiceTimer = null;
    const voiceInputBtn = document.getElementById('voiceInputBtn');
    const voiceHint = document.getElementById('voiceHint');

    function startRecording() {
        if (mediaRecorderVoice && mediaRecorderVoice.state === 'recording') return;
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                voiceStream = stream;
                mediaRecorderVoice = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                audioChunksVoice = [];
                
                mediaRecorderVoice.ondataavailable = (event) => {
                    if (event.data.size > 0) audioChunksVoice.push(event.data);
                };
                
                mediaRecorderVoice.onstop = () => {
                    if (audioChunksVoice.length === 0) return;
                    const audioBlob = new Blob(audioChunksVoice, { type: 'audio/webm' });
                    const formData = new FormData();
                    formData.append('audio', audioBlob, 'voice.webm');
                    
                    // 显示加载中
                    voiceInputBtn.disabled = true;
                    voiceInputBtn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i>';
                    
                    fetch('/asr', { method: 'POST', body: formData })
                        .then(res => res.json())
                        .then(data => {
                            if (data.text) {
                                const chatInput = document.getElementById('chatInput');
                                const current = chatInput.value;
                                chatInput.value = current ? current + ' ' + data.text : data.text;
                                chatInput.focus();
                            } else {
                                alert('语音识别失败');
                            }
                        })
                        .catch(err => {
                            console.error(err);
                            alert('识别出错');
                        })
                        .finally(() => {
                            voiceInputBtn.disabled = false;
                            voiceInputBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                            voiceHint.classList.add('hidden');
                        });
                    
                    if (voiceStream) {
                        voiceStream.getTracks().forEach(track => track.stop());
                        voiceStream = null;
                    }
                    mediaRecorderVoice = null;
                };
                
                mediaRecorderVoice.start();
                voiceHint.classList.remove('hidden');
                voiceHint.textContent = '松手发送';
                
                // 最长录音 30 秒自动停
                voiceTimer = setTimeout(() => {
                    if (mediaRecorderVoice && mediaRecorderVoice.state === 'recording') {
                        stopRecording();
                    }
                }, 30000);
            })
            .catch(err => {
                console.error('麦克风权限错误:', err);
                alert('无法访问麦克风');
            });
    }

    function stopRecording() {
        if (voiceTimer) clearTimeout(voiceTimer);
        if (mediaRecorderVoice && mediaRecorderVoice.state === 'recording') {
            mediaRecorderVoice.stop();
        } else {
            voiceHint.classList.add('hidden');
        }
    }

    // 绑定事件（PC：鼠标；移动端：触摸）
    if (voiceInputBtn) {
        voiceInputBtn.addEventListener('mousedown', startRecording);
        voiceInputBtn.addEventListener('mouseup', stopRecording);
        voiceInputBtn.addEventListener('mouseleave', stopRecording);
        voiceInputBtn.addEventListener('touchstart', startRecording);
        voiceInputBtn.addEventListener('touchend', stopRecording);
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('您的浏览器不支持录音功能');
        document.querySelectorAll('.mode-option[data-mode="record"]').forEach(btn => { btn.style.display = 'none'; });
    }
    switchMode('upload');
});

document.getElementById('clearChatBtn')?.addEventListener('click',() => {
    if (chatMessages && confirm('确定清空当前对话记录？(仅影响显示，数据库记录保留)'))
    {
        chatMessages.innerHTML = '';
    }
})

