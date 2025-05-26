from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import jwt, JWTError
from passlib.context import CryptContext
import secrets

from fastapi import Depends, HTTPException, status, Request, Cookie # Añadido
from fastapi.responses import RedirectResponse

from sqlalchemy.orm import Session # Añadido

from app.models import User  # Añadido
from app.database import get_db  # Añadido

SECRET_KEY = secrets.token_hex(32)  # Clave generada y hardcodeada
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None

async def get_current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("access_token")

    #if token is None:
    # Redirigir a login si no hay token y no es una ruta de API
    #    if "/api/" not in request.url.path:
    #        return RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)
    #    raise HTTPException(
    #        status_code=status.HTTP_401_UNAUTHORIZED,
    #        detail="Not authenticated",
    #        headers={"WWW-Authenticate": "Bearer"},
    #    )
    if token is None and "/api/" in request.url.path:
    # Solo aceptamos Authorization si es una ruta de API
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split("Bearer ")[1]

    # Añadir esta verificación para manejar el caso donde el token sigue siendo None
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated or invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    username = decode_token(token)
    if username is None:
        # Redirigir a login si el token es inválido y no es una ruta de API
        if "/api/" not in request.url.path:
            response = RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)
            response.delete_cookie("access_token") # Asegurar que se borre la cookie inválida
            return response
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        # Redirigir a login si el usuario no existe y no es una ruta de API
        if "/api/" not in request.url.path:
            response = RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)
            response.delete_cookie("access_token") # Asegurar que se borre la cookie inválida
            return response
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user

def authenticate_user(db: Session, username: str, password: str):
    """
    Verifica si el usuario existe y si la contraseña es válida.
    Retorna el usuario si es correcto, de lo contrario None.
    """
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user
