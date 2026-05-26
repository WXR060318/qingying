import os

import uvicorn


if __name__ == "__main__":
    reload_enabled = os.getenv("QINGYING_RELOAD", "0") == "1"
    port = int(os.getenv("QINGYING_BACKEND_PORT", "8765"))
    if reload_enabled:
        uvicorn.run("app.main:app", host="127.0.0.1", port=port, reload=True)
    else:
        from app.main import app

        uvicorn.run(app, host="127.0.0.1", port=port, reload=False)
