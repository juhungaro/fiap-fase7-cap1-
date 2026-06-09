import uvicorn
import os

if __name__ == "__main__":
    print("Iniciando servidor de desenvolvimento CardioIA...")
    # Garante que o uvicorn consiga localizar o pacote app
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
