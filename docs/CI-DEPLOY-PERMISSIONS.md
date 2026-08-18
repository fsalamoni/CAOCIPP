# Permissões GCP necessárias para o CI

O deploy automático (`.github/workflows/deploy.yml`) usa a **service account** configurada no secret `FIREBASE_SERVICE_ACCOUNT`.

## Para que a Cloud Function `checkPartnershipNoticeDeadlines` funcione

A Cloud Function agendada (`functions-v2/src/scheduled/checkPartnershipNoticeDeadlines.ts`) precisa de permissão para criar e atualizar o job do Cloud Scheduler associado.

A SA do CI precisa do papel:

- **Cloud Scheduler Admin** (`roles/cloudscheduler.admin`)

Este papel dá as permissões:
- `cloudscheduler.jobs.create`
- `cloudscheduler.jobs.update`
- `cloudscheduler.jobs.delete`
- `cloudscheduler.jobs.run`
- `cloudscheduler.jobs.pause`
- `cloudscheduler.jobs.resume`

## Como conceder

1. Acessar: https://console.cloud.google.com/iam-admin/iam?project=protagonista-rpg
2. Localizar a service account (ex: `consultas-cao@protagonista-rpg.iam.gserviceaccount.com`)
3. Clicar em "Edit" (lápis)
4. Clicar em "Add another role"
5. Selecionar "Cloud Scheduler Admin"
6. Salvar

## Estado atual

- **Item 7/8/9 (avisos automáticos)**: schema, UI e backend **ATIVOS** em produção.
- **Cloud Function agendada**: PAUSADA (comentada em `functions-v2/src/index.ts`).
- **Próximo passo**: conceder a permissão acima, depois descomentar a linha em `functions-v2/src/index.ts`:
  ```ts
  export { checkPartnershipNoticeDeadlines } from './scheduled/checkPartnershipNoticeDeadlines';
  ```
  E fazer o deploy.

## Histórico de deploys que falharam por permissão

- PR #78 (SHA 030d368): API habilitada mas SA sem `cloudscheduler.jobs.update` → função criada, job falhou
- PR #83 (SHA 8a319f9): tentou deletar job via gcloud mas SA sem `cloudscheduler.jobs.delete`
