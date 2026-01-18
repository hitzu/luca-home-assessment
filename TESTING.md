# Testing

## 1. Testing strategy

- Manual testing is done with the Bruno collection in `collection-zendly`; every request present there is treated as “manually exercised at least once”.
- Automated testing uses Jest. Most specs are service-level and run against the TypeORM data source (logic + persistence), not HTTP controllers. The only e2e test hits the root controller.
- Scope reminder: this backend manages inbox, allocation, and metadata only (no real auth provider, no message delivery). Coverage focuses on allocation logic, state transitions, and metadata consistency.

## 2. Manual testing (Bruno collections)

Each entry lists the request method and path present in Bruno; these are considered manually tested.

### Auth

- `POST /auth/signup`
- `POST /auth/login`

### Tenants

- `POST /tenants`
- `GET /tenants`

### Operators

- `POST /operators`
- `GET /operators`
- `GET /operators/{id}`

### Inboxes

- `POST /inboxes`
- `GET /inboxes`

### Operator inbox subscriptions

- `POST /operator-inbox-subscriptions`

### Conversations

- `POST /conversations` – create conversation metadata
- `GET /conversations` – list with filters
- `GET /conversations?labelId={id}` – filter by label
- `GET /conversations/search/by-phone?phoneNumber=...` – search by phone

### Allocation

- `GET /allocation` – current allocations
- `POST /allocation/allocate` – auto-allocate next conversation
- `POST /allocation/claim` – claim a queued conversation
- `POST /allocation/resolve` – resolve allocated conversation
- `POST /allocation/deallocate` – return to queue
- `POST /allocation/reassign` – reassign to another operator
- `POST /allocation/move-inbox` – move conversation to another inbox

### Labels

- `POST /labels` – create label
- `GET /labels` – list labels (tenant-wide or by `labelId`)
- `GET /labels?inboxId={id}` – list by inbox
- `POST /conversations/{conversationId}/labels/{labelId}` – attach label
- `DELETE /conversations/{conversationId}/labels/{labelId}` – detach label

### Operator status & grace period

- `GET /operator-status/me`
- `POST /operator-status/me` – set status
- `POST /grace-period/process` – cron-style requeue of expired grace periods

### Operator inbox subscriptions

- `POST /operator-inbox-subscriptions`

## 3. Automated tests (Jest)

### Allocation

- `src/allocation/allocation.service.spec.ts` (service/unit with DB): allocation selection (priority + recency tie-break), null cases when no inbox subscriptions or no queued items, race safety when candidate not queued, claim validation (queued + subscribed), resolve permissions (owner vs manager/admin), deallocate to queue, reassign permission/tenant/inbox checks, move inbox resets allocation.

### Conversations

- `src/conversations/conversations.service.spec.ts` (service/unit): list filtering (inbox/state/operator) and priority sorting, findById happy/missing, updateMetadata returns undefined when not found.

### Inboxes

- `src/inboxes/inboxes.service.spec.ts` (service/unit): create inbox, list active by tenant, listByIds scoping, findById, update phone/displayName, soft delete.

### Labels

- `src/labels/labels.service.spec.ts` (service/unit): create label (null/empty color handling, uniqueness, tenant/inbox guards), list (tenant-wide and by inbox, ordering), get with tenant scoping, update (name/color/conflict), delete with tenant checks, attach/detach label to conversation with inbox/tenant validations and idempotency.

### Operator inbox subscriptions

- `src/operator-inbox-subscriptions/operator-inbox-subscriptions.service.spec.ts` (service/unit): create with operator/inbox existence validation, list by tenant with operator/inbox filters, remove with tenant scoping and missing-id no-op.

### Operator status & grace period

- `src/operator-status/operator-status.service.spec.ts` (service/unit): setStatus offline creates status + grace assignments and expiry, forbidden/NotFound cases, setStatus available clears grace assignments, getStatus returns null/tenant-scoped/forbidden.
- `src/operator-status/grace-period.service.spec.ts` (service/unit): processExpiredGracePeriods requeues allocated conversations, clears or retains assignment based on state, deletes orphaned assignments.

### Operators

- `src/operators/operators.service.spec.ts` (service/unit): create operator, update name, findAll.

### Tenants

- `src/tenants/tenants.service.spec.ts` (service/unit): create tenant, findAll empty and populated.

### E2E

- Integration tests live under `src/**/*.spec.ts` and run via `pnpm test`.

## 4. Coverage matrix (critical flows)

Legend: **Yes** = covered, **Partial** = some paths only, **No** = uncovered.

| Flow                                                               | Manual (Bruno/cURL)                   | Automated (Jest)                                  |
| ------------------------------------------------------------------ | ------------------------------------- | ------------------------------------------------- |
| Tenant create/list                                                 | Yes                                   | Yes (service)                                     |
| Operator create/list/get                                           | Yes                                   | Yes (service)                                     |
| Operator status set/get                                            | Yes (`/operator-status/me`)           | Yes (service logic)                               |
| Inbox create/list/update/delete                                    | Yes (create/list)                     | Yes (service)                                     |
| Operator inbox subscriptions (create/list/me)                      | Yes (`/operator-inbox-subscriptions`) | Yes (service)                                     |
| Conversation create/list/search/filter                             | Yes (filters, phone, paging, sort)    | Partial (list filters/sort, find, updateMetadata) |
| Conversation history proxy                                         | Yes (`/conversations/{id}/history`)   | No                                                |
| Conversation contact                                               | Yes (`/conversations/{id}/contact`)   | No                                                |
| Allocation (allocate/claim/resolve/deallocate/reassign/move inbox) | Yes                                   | Yes (service logic)                               |
| Labels (create/list/update/delete/attach/detach)                   | Yes                                   | Yes (service logic + validations)                 |
| Grace period cron requeue                                          | Yes (`/grace-period/process`)         | Yes (service logic)                               |
| Auth signup/login                                                  | Yes                                   | No                                                |
| Root health                                                        | Not covered manually                  | Yes (`GET /`)                                     |

create operator, set status as offline

curl --request POST \
 --url http://localhost:3000/operators \
 --header 'content-type: application/json' \
 --data '{
"name": "test OPERATOR",
"tenantId": 1,
"role": "OPERATOR"
}'

curl --request POST \
 --url http://localhost:3000/operator-status/me \
 --header 'authorization: Bearer DEV.v1.1.9.OPERATOR.1765322847' \
 --header 'content-type: application/json' \
 --data '{
"status": "OFFLINE / AVAILABLE"
}'
Update status AVAILABLE or OFFLINE

curl --request GET \
 --url http://localhost:3000/operator-status/me \
 --header 'authorization: Bearer DEV.v1.1.9.OPERATOR.1765322847' \
 --header 'content-type: application/json' \
 --data '{}'
Read status

curl --request GET \
 --url http://localhost:3000/operator-inbox-subscriptions/me \
 --header 'authorization: Bearer DEV.v1.1.6.MANAGER.1765324377' \
 --header 'content-type: application/json'
List inboxes available to operator

Conversation lists

curl --request GET \
 --url http://localhost:3000/conversations \
 --header 'authorization: Bearer {{tokenOperator}}' \
 --header 'content-type: application/json'

List by inbox

curl --request GET \
 --url 'http://localhost:3000/conversations?inboxId=1' \
 --header 'authorization: Bearer DEV.v1.1.4.ADMIN.1765226756' \
 --header 'content-type: application/json'

filter by state, operator and label and phone number

curl --request GET \
 --url 'http://localhost:3000/conversations?state=QUEUED' \
 --header 'authorization: Bearer DEV.v1.1.4.ADMIN.1765226756' \
 --header 'content-type: application/json'

curl --request GET \
 --url 'http://localhost:3000/conversations?assignedOperatorId=9' \
 --header 'authorization: Bearer DEV.v1.1.4.ADMIN.1765226756' \
 --header 'content-type: application/json'

curl --request GET \
 --url 'http://localhost:3000/conversations?labelId=1' \
 --header 'authorization: Bearer DEV.v1.1.4.ADMIN.1765226756' \
 --header 'content-type: application/json'

curl --request GET \
 --url 'http://localhost:3000/conversations?customerPhoneNumber=%2015555550002' \
 --header 'authorization: Bearer DEV.v1.1.4.ADMIN.1765226756' \
 --header 'content-type: application/json'

pagination support

curl --request GET \
 --url 'http://localhost:3000/conversations?limit=2&page=2' \
 --header 'authorization: Bearer DEV.v1.1.4.ADMIN.1765226756' \
 --header 'content-type: application/json'

sorting

curl --request GET \
 --url 'http://localhost:3000/conversations?sort=newest' \
 --header 'authorization: Bearer DEV.v1.1.4.ADMIN.1765226756' \
 --header 'content-type: application/json'

allocate returns one conversation

curl --request POST \
 --url http://localhost:3000/allocation/allocate \
 --header 'authorization: Bearer {{tokenOperator}}' \
 --header 'content-type: application/json'

claim for specific conversation

curl --request POST \
 --url http://localhost:3000/allocation/claim \
 --header 'authorization: Bearer DEV.v1.1.9.OPERATOR.1765322847' \
 --header 'content-type: application/json' \
 --data '{
"conversationId": 5
}'

resolve

curl --request POST \
 --url http://localhost:3000/allocation/resolve \
 --header 'authorization: Bearer DEV.v1.1.7.OPERATOR.1765232352' \
 --header 'content-type: application/json' \
 --data '{
"conversationId": "2"
}'

deallocate

curl --request POST \
 --url http://localhost:3000/allocation/deallocate \
 --header 'authorization: Bearer DEV.v1.1.4.ADMIN.1765226756' \
 --header 'content-type: application/json' \
 --data '{
"conversationId": 1
}'

reassign to another operator

curl --request POST \
 --url http://localhost:3000/allocation/reassign \
 --header 'authorization: Bearer DEV.v1.1.4.ADMIN.1765226756' \
 --header 'content-type: application/json' \
 --data '{
"conversationId": 1,
"newOperatorId": 4
}'

move_inbox to another inbox in same tenant

curl --request POST \
 --url http://localhost:3000/allocation/move-inbox \
 --header 'authorization: Bearer DEV.v1.1.4.ADMIN.1765226756' \
 --header 'content-type: application/json' \
 --data '{
"conversationId": 1,
"newInboxId": 2
}'

create label

curl --request POST \
 --url http://localhost:3000/labels \
 --header 'authorization: Bearer DEV.v1.1.4.ADMIN.1765226756' \
 --header 'content-type: application/json' \
 --data '{
"inboxId": 1,
"name": "VIP",
"color": "#FF5733"
}'

list labels

curl --request GET \
 --url http://localhost:3000/labels/1 \
 --header 'authorization: Bearer DEV.v1.1.4.ADMIN.1765226756' \
 --header 'content-type: application/json'

update label

curl --request PATCH \
 --url http://localhost:3000/labels/1 \
 --header 'authorization: Bearer DEV.v1.1.7.OPERATOR.1765232352' \
 --header 'content-type: application/json' \
 --data '{
"name": "VIP 123",
"color": "#FF5733"
}'

delete label

curl --request DELETE \
 --url http://localhost:3000/labels/2 \
 --header 'authorization: Bearer DEV.v1.1.7.OPERATOR.1765232352' \
 --header 'content-type: application/json'

attach label to conversation

curl --request POST \
 --url http://localhost:3000/conversations/5/labels/1 \
 --header 'authorization: Bearer DEV.v1.1.7.OPERATOR.1765232352' \
 --header 'content-type: application/json'

detach label to conversation

curl --request DELETE \
 --url http://localhost:3000/conversations/2/labels/1 \
 --header 'authorization: Bearer DEV.v1.1.7.OPERATOR.1765232352' \
 --header 'content-type: application/json'

get history proxy

curl --request GET \
 --url http://localhost:3000/conversations/8/history \
 --header 'authorization: Bearer DEV.v1.1.4.ADMIN.1765226756' \
 --header 'content-type: application/json'

get contact

curl --request GET \
 --url http://localhost:3000/conversations/8/contact \
 --header 'authorization: Bearer DEV.v1.1.4.ADMIN.1765226756' \
 --header 'content-type: application/json'
