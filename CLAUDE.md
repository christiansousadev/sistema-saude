# contexto do sistema
sistema de saúde pessoal para rastreamento físico (fotos/peso) e clínico (exames de sangue), utilizando ia (local e llm) para extração de dados e análise de evolução.

# arquitetura
- frontend: next.js (app router), react, tailwindcss.
- backend: python (fastapi), sqlalchemy, alembic.
- banco de dados: postgresql.

# regras estritas de código e governança
1. os comentários no código devem ser breves e soar como um desenvolvedor real, usando apenas letras minúsculas para lógica interna.
2. para destacar exclusivamente o início de uma função, use sempre CAIXA ALTA (ex: # INICIA SESSAO DO BANCO).
3. nunca use palavras como "corrigido", "correção", "altere aqui" ou "código novo".
4. nunca use traços em comentários (ex: --- comentário ---).
5. aplique boas práticas de governança por padrão: use blocos try/catch claros e informativos, isole credenciais em variáveis de ambiente e retorne logs estruturados para auditoria.
6. priorize modularidade, entregando blocos completos sem omitir imports ou retornos.