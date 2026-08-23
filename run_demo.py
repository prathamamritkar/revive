import os
import sys
import time
import subprocess
import requests
from dotenv import load_dotenv

load_dotenv()

def get_python_executable():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    venv_py = os.path.join(base_dir, "venv", "Scripts", "python.exe")
    if os.path.exists(venv_py):
        return venv_py
    dot_venv_py = os.path.join(base_dir, ".venv", "Scripts", "python.exe")
    if os.path.exists(dot_venv_py):
        return dot_venv_py
    return sys.executable

def is_port_in_use(port):
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def start_backend(py_exe):
    if is_port_in_use(8000):
        print("  [ONLINE] FastAPI Engine backend already running on port 8000.")
        return None
    print("  [LAUNCHING] Starting FastAPI backend on http://127.0.0.1:8000 ...")
    proc = subprocess.Popen([py_exe, "app.py"], cwd=os.path.dirname(os.path.abspath(__file__)))
    time.sleep(3)
    return proc

def start_dashboard(py_exe):
    if is_port_in_use(8501):
        print("  [ONLINE] Streamlit Command Center already running on http://localhost:8501")
        return None
    print("  [LAUNCHING] Starting Streamlit Command Center on http://localhost:8501 ...")
    base_dir = os.path.dirname(os.path.abspath(__file__))
    st_exe = os.path.join(base_dir, "venv", "Scripts", "streamlit.exe")
    if not os.path.exists(st_exe):
        st_exe = "streamlit"
    proc = subprocess.Popen([st_exe, "run", "dashboard.py"], cwd=base_dir)
    time.sleep(3)
    return proc

def setup_tunnel():
    print("  [TUNNEL] Establishing public HTTPS Webhook Tunnel...")
    try:
        from pyngrok import ngrok, conf
        ngrok_token = os.getenv("NGROK_AUTHTOKEN")
        if ngrok_token:
            conf.get_default().auth_token = ngrok_token
        tunnel = ngrok.connect(8000, bind_tls=True)
        public_url = tunnel.public_url
        print(f"  [TUNNEL LIVE] Public URL: {public_url}")
        print(f"  [WEBHOOK URL]: {public_url}/webhook/payment")
        return public_url
    except Exception as e:
        print(f"  [TUNNEL NOTICE] pyngrok fallback: {e}")
        print("  [LOCAL WEBHOOK URL]: http://localhost:8000/webhook/payment")
        return "http://localhost:8000"

def main():
    print("=" * 80)
    print(" REVIVE — AUTONOMOUS 1-CLICK DEMO ORCHESTRATOR")
    print("=" * 80)

    py_exe = get_python_executable()
    print(f"  [ENV] Using Python Interpreter: {py_exe}")

    backend_proc = start_backend(py_exe)
    dash_proc = start_dashboard(py_exe)
    public_url = setup_tunnel()

    print("\n" + "=" * 80)
    print(" SYSTEM FULLY OPERATIONAL & READY FOR LIVE DEMO")
    print("=" * 80)
    print(f"  * Streamlit Command Center : http://localhost:8501")
    print(f"  * FastAPI OpenAPI Specs    : http://localhost:8000/docs")
    print(f"  * Live Webhook URL         : {public_url}/webhook/payment")
    print(f"  * Health Observability Probe: http://localhost:8000/api/v1/readiness")
    print("=" * 80)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping services...")
        if backend_proc:
            backend_proc.terminate()
        if dash_proc:
            dash_proc.terminate()
        print("Done.")

if __name__ == "__main__":
    main()
