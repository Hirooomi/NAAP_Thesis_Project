from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import models
from database import get_db
import ai_engine
from pydantic import BaseModel
from socket_manager import manager

# Only ONE router initialization for the file
router = APIRouter(prefix="/api/vault", tags=["Database Vault"])

class StatusUpdateRequest(BaseModel):
    status: str

class SaveAssetRequest(BaseModel):
    id: str
    type: str
    title: str
    author: str
    category: str
    questions: int = 0
    content_payload: Optional[str] = ""
    status: Optional[str] = "ACTIVE"  

# ==========================================
# ADMIN ROUTES (MANAGING THE VAULT)
# ==========================================

@router.get("/assets")
def get_vault_assets(db: Session = Depends(get_db)):
    """Fetches all Modules and Quizzes from the secure Database Vault."""
    try:
        assets = db.query(models.VaultAsset).all()
        modules = []
        quizzes = []
        
        for a in assets:
            data = {
                "id": a.id,
                "title": a.title,
                "author": a.author,
                "category": a.category,
                "status": a.status
            }
            if a.type == "MODULE":
                modules.append(data)
            elif a.type == "QUIZ":
                data["questions"] = a.questions
                quizzes.append(data)
                
        return {"status": "success", "modules": modules, "quizzes": quizzes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vault Error: {str(e)}")

@router.post("/save")
async def save_vault_asset(req: SaveAssetRequest, db: Session = Depends(get_db)):
    """Saves a newly published Module or Quiz to the Vault."""
    try:
        new_asset = models.VaultAsset(
            id=req.id, type=req.type, title=req.title, author=req.author,
            category=req.category, questions=req.questions,
            content_payload=req.content_payload, status=req.status
        )
        db.add(new_asset)
        db.commit()
        
        # THE FIX: Broadcast that the vault was updated!
        await manager.broadcast({"event": "VAULT_UPDATE", "message": "A new asset was published!"})
        
        return {"status": "success", "message": "Asset successfully published to Vault."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/status/{asset_id}")
def update_asset_status(asset_id: str, req: StatusUpdateRequest, db: Session = Depends(get_db)):
    """Soft Purge (Ghosting) or Restoring an asset."""
    asset = db.query(models.VaultAsset).filter(models.VaultAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found in the Vault.")
    
    try:
        asset.status = req.status
        db.commit()
        return {"status": "success", "message": f"Asset {asset_id} status changed to {req.status}."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/purge/{asset_id}")
async def hard_purge_asset(asset_id: str, db: Session = Depends(get_db)):
    """Tier 0 Action: Permanently deletes an asset from the PostgreSQL Database & ChromaDB."""
    asset = db.query(models.VaultAsset).filter(models.VaultAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found in the Vault.")
    
    try:
        if asset.type == "MODULE":
            ai_engine.delete_rag_vectors_by_title(asset.title)
            
        db.delete(asset)
        db.commit()
        
        # THE FIX: Broadcast the deletion to the UI!
        await manager.broadcast({"event": "VAULT_UPDATE", "message": "Asset permanently purged."})
        
        return {"status": "success", "message": f"Asset {asset_id} permanently purged."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# STUDENT ROUTES (READING FROM THE VAULT)
# ==========================================

@router.get("/catalog")
def get_catalog(db: Session = Depends(get_db)):
    """Fetches all active modules and groups them by CAAP Subject"""
    try:
        assets = db.query(models.VaultAsset).filter(models.VaultAsset.status == "ACTIVE", models.VaultAsset.type == "MODULE").all()
        catalog = []
        for a in assets:
            catalog.append({
                "id": a.id,
                "title": a.title,
                "category": a.category
            })
        return {"status": "success", "catalog": catalog}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/module-by-title/{title}")
def get_module_by_title(title: str, db: Session = Depends(get_db)):
    """Fetches the raw RAG chunk text for the Reader UI"""
    asset = db.query(models.VaultAsset).filter(models.VaultAsset.title == title, models.VaultAsset.type == "MODULE").first()
    if not asset:
        raise HTTPException(status_code=404, detail="Module document not found in the vault.")
    
    return {"status": "success", "title": asset.title, "content": asset.content_payload}

class RAGSearchRequest(BaseModel):
    query: str

@router.post("/rag-search")
def perform_rag_search(req: RAGSearchRequest):
    """Hits the ChromaDB Vector Database and Generates a Semantic AI Answer"""
    try:
        result = ai_engine.query_rag_engine(req.query)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))