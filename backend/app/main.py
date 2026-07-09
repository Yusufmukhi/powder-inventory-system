import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from dotenv import load_dotenv

from app.routers import customers, powders, jobs, suppliers, expenses, auth, companies

load_dotenv()

app = FastAPI(title="Powder Coating Inventory & Job Management API")

origins = [os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=500)

app.include_router(customers.router)
app.include_router(powders.router)
app.include_router(jobs.router)
app.include_router(suppliers.router)
app.include_router(expenses.router)
app.include_router(auth.router)
app.include_router(companies.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "powder-inventory-system"}