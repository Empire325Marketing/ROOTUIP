from fastapi import FastAPI
from pydantic import BaseModel
from .predict import predict_dd_risk

app = FastAPI()

class Features(BaseModel):
    feature_data: dict

@app.post("/predict")
async def get_prediction(features: Features):
    return predict_dd_risk(features.feature_data)
