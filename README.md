# Voll Demo Entrega

Demo de laboratorio para o fluxo de entrega assistida do Voll 360.

## Fluxo

1. Motorista tenta entregar uma geladeira.
2. Cliente Maria Souza nao esta em casa.
3. Central abre a ocorrencia e faz ate 3 acionamentos WhatsApp (`try` 1, 2 e 3, `to` 1007).
4. Se necessario, a central aciona voz para o cliente (`action: VOICE`, `to: 1007`).
5. Cliente confirma que pode receber ainda hoje.
6. Sistema aciona voz para o motorista (`action: VOICE`, `to: 1008`).
7. A interface registra os POSTs, bodies e retornos.

## Arquitetura

O navegador chama o backend local em `/api/trigger`. O `server.js` faz o POST real para a API Voll, evitando CORS e sem expor a API key no JavaScript.

## Executar

Requer Node.js 18+.

```bash
export VOLL_API_KEY='SUA_CHAVE'
npm start
```

Abra `http://localhost:3001`.

Se o endpoint tambem exigir cookie de sessao:

```bash
export VOLL_COOKIE='_ucc_session=...'
```

## Bodies

WhatsApp:

```json
{"action":"WHATSAPP","whatsapp":"5511989785888","try":1,"to":"1007"}
```

Voz cliente:

```json
{"action":"VOICE","whatsapp":"5511989785888","try":3,"to":"1007"}
```

Voz motorista:

```json
{"action":"VOICE","whatsapp":"5511989785888","try":3,"to":"1008"}
```

## Seguranca

Nao versionar API keys, cookies ou arquivos `.env`.
