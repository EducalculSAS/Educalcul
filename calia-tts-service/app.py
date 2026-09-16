import io
import os

import scipy.io.wavfile
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import Response
from pocket_tts import TTSModel
from pydantic import BaseModel

SECRET = os.environ["CALIA_TTS_SECRET"]

app = FastAPI()
model = TTSModel.load_model(language="french_24l")
voice_state = model.get_state_for_audio_prompt("estelle")


class SpeakRequest(BaseModel):
    text: str


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/speak")
def speak(body: SpeakRequest, authorization: str = Header(default="")):
    if authorization != f"Bearer {SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    text = body.text.strip()[:400]
    if not text:
        raise HTTPException(status_code=400, detail="text est requis")

    audio = model.generate_audio(voice_state, text)
    buf = io.BytesIO()
    scipy.io.wavfile.write(buf, model.sample_rate, audio.numpy())
    return Response(content=buf.getvalue(), media_type="audio/wav")
