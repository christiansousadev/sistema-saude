"""
instancia compartilhada do rate limiter (slowapi).

isolada em módulo próprio para evitar import circular entre main.py
(que registra o limiter no app) e os endpoints (que precisam do decorator).
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

# INICIA LIMITER GLOBAL
limiter = Limiter(key_func=get_remote_address)
