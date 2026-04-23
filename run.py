import os
import subprocess
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
#检查下载模型是否存在

subprocess.run(
    [
        sys.executable,
        os.path.join(current_dir, "models_cache", "model_download.py")
    ],
    check=True,
    )

#运行主程序
print("运行FASTAPI主程序")
# subprocess.run(
#     [
#         sys.executable,
#         "-m","uvicorn",
#         "app.main:app",
#         "--reload",
#         "--app-dir", current_dir
#     ],
#     check=True,
# ) #本地运行

subprocess.run(
    [
        sys.executable,
        "-m","uvicorn",
        "app.main:app",
        "--reload",
        "--host", "0.0.0.0",
        "--port","6006",#audodl云服务器用此端口进行映射
        "--app-dir", current_dir
    ],
    check=True,
) #服务器上运行
