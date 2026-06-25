# Integração WhatsApp — METRIXHR × Evolution API

> **Status:** Documento de planejamento técnico. Nenhuma implementação foi realizada.
> Este arquivo serve como referência para a futura integração WhatsApp do METRIXHR
> via Evolution API.

---

## 1. Objetivo da Integração

Permitir que o METRIXHR envie mensagens transacionais e operacionais via WhatsApp
para colaboradores, candidatos e usuários do sistema, utilizando a **Evolution API**
como gateway de comunicação com o WhatsApp.

A integração tem finalidade **estritamente operacional** — notificações vinculadas
ao uso do sistema (autenticação, comunicações internas, processos seletivos,
lembretes operacionais e suporte). Não se destina a marketing nem a comunicação
comercial.

---

## 2. Arquitetura Prevista

```
┌────────────┐      ┌────────────────┐      ┌────────────────┐      ┌──────────┐
│  METRIXHR  │ ───▶ │  Edge Function │ ───▶ │  Evolution API │ ───▶ │ WhatsApp │
│ (Frontend/ │      │   (Backend)    │      │   (Gateway)    │      │ (Usuário)│
│  Backend)  │      │                │      │                │      │          │
└────────────┘      └────────────────┘      └────────────────┘      └──────────┘
```

**Fluxo:**

1. Evento ocorre no METRIXHR (ex.: convite, redefinição de senha).
2. O backend dispara uma chamada para uma **Edge Function** dedicada.
3. A Edge Function valida permissões, consentimento e template.
4. A Edge Function chama a **Evolution API** com a API Key armazenada em **Secrets**.
5. A Evolution API entrega a mensagem ao WhatsApp do destinatário.
6. O retorno é registrado em `whatsapp_envios` para auditoria.

**Princípio-chave:** O frontend **nunca** conversa diretamente com a Evolution API.

---

## 3. Eventos Permitidos

Apenas os seguintes eventos podem disparar mensagens via WhatsApp:

| Evento                        | Descrição                                                    |
| ----------------------------- | ------------------------------------------------------------ |
| Convite de acesso             | Onboarding de novo usuário no sistema                        |
| Redefinição de senha          | Envio de link/código para recuperação de conta               |
| Nova comunicação              | Aviso de comunicado interno publicado para o colaborador     |
| Lembrete de check-in          | Lembrete operacional de presença / ponto / evento agendado   |
| Candidatura aprovada          | Retorno de processo seletivo aos candidatos                  |
| Aviso de pendência            | Documentos, tarefas ou aprovações pendentes do usuário       |
| Suporte operacional           | Atendimento iniciado pelo time de suporte ao usuário ativo   |

---

## 4. Eventos Proibidos

Estão **expressamente proibidos** pela política da integração:

- ❌ **Disparo em massa** (broadcast comercial, listas, campanhas).
- ❌ **Marketing sem consentimento** explícito e específico do usuário.
- ❌ **Mensagens comerciais não solicitadas** (ofertas, promoções, vendas).

Qualquer rotina que viole estas regras deve ser bloqueada na Edge Function
antes da chamada à Evolution API.

---

## 5. Regras LGPD

A integração deve respeitar a Lei Geral de Proteção de Dados (Lei 13.709/2018):

- **Consentimento do usuário:** O envio via WhatsApp requer consentimento prévio,
  específico, informado e registrado (base legal — Art. 7º, I da LGPD, ou
  execução de contrato quando aplicável).
- **Opção de desativar WhatsApp:** O usuário pode, a qualquer momento, revogar
  o consentimento e desativar o canal WhatsApp em suas preferências, sem
  prejuízo do acesso ao sistema.
- **Registro de envio:** Todo envio deve ser persistido (`whatsapp_envios`) com
  data, destinatário, template, status e finalidade — para auditoria e
  cumprimento de pedidos de titular.
- **Finalidade operacional:** Os dados pessoais (telefone) só podem ser usados
  para os eventos previstos no item 3. Qualquer outro uso exige nova base legal.

Recomenda-se também: minimização de dados na mensagem (não enviar dados
sensíveis pelo WhatsApp), retenção definida dos registros de envio, e
documentação no RIPD (Relatório de Impacto à Proteção de Dados).

---

## 6. Tabelas Futuras Sugeridas

> Estrutura proposta — **ainda não criada no banco**.

### `whatsapp_configuracoes`
Configurações globais e por tenant da integração.
- `id`, `tenant_id`, `instancia_evolution`, `numero_remetente`, `ativo`,
  `criado_em`, `atualizado_em`.

### `whatsapp_envios`
Histórico de todas as mensagens disparadas (auditoria LGPD).
- `id`, `usuario_id`, `telefone`, `template_id`, `evento`, `payload`,
  `status` (`enviado`, `entregue`, `lido`, `falhou`), `erro`,
  `provider_message_id`, `criado_em`.

### `whatsapp_templates`
Templates de mensagem versionados e aprovados.
- `id`, `codigo`, `evento`, `titulo`, `corpo`, `variaveis`, `versao`,
  `ativo`, `criado_em`.

### `whatsapp_consentimentos`
Registro do consentimento (opt-in/opt-out) por usuário.
- `id`, `usuario_id`, `consentido`, `origem` (onboarding, perfil, etc.),
  `ip`, `user_agent`, `consentido_em`, `revogado_em`.

Todas as tabelas devem ter **RLS habilitado**, **GRANTs explícitos** e
acesso restrito ao próprio usuário / administradores do tenant.

---

## 7. Segurança

- 🔐 **API Key da Evolution API** armazenada **somente em Secrets** do backend
  (nunca em código, nunca em variáveis `VITE_*`, nunca em tabelas de configuração).
- 🚫 **Nunca expor a Evolution API no frontend** — o cliente não deve conhecer
  endpoint, instância ou credenciais do gateway.
- 📤 **Todo envio passa por Edge Function** dedicada, que:
  - autentica o chamador (sessão válida + autorização);
  - valida consentimento ativo em `whatsapp_consentimentos`;
  - aplica rate limiting por usuário e por tenant;
  - usa apenas templates aprovados de `whatsapp_templates`;
  - registra o envio em `whatsapp_envios`.
- 🔍 Logs sem dados sensíveis (mascarar telefone e conteúdo nas saídas).
- 🛡️ Webhooks da Evolution API (status de entrega) devem validar assinatura
  ou token compartilhado antes de atualizar `whatsapp_envios`.

---

## 8. Roadmap

| Versão | Escopo                                                                 |
| ------ | ---------------------------------------------------------------------- |
| **V1.1** | Envio básico — eventos transacionais (convite, senha, comunicação)   |
| **V1.2** | Automações — lembretes de check-in, pendências, candidatura aprovada |
| **V1.3** | Integração com MENA — orquestração de jornadas e suporte operacional |

---

**Documento gerado para planejamento. Nenhum código, banco ou Secret foi alterado.**
