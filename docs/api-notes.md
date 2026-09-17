# Perform automation API notes

The contract this node implements. It was taken from the definition of the
Perform Make.com custom app (version 1, 24 modules, 5 RPCs, 1 webhook), which
is the same API surface, so every endpoint below is one Make already calls in
production. Items marked **verify** are assumptions worth confirming with
`npm run smoke` / `npm run verify:live` against a real studio.

## Transport

| | |
|---|---|
| Base URL | `https://perform-api.otherwise.co.il/v1/automation` |
| Auth | `Authorization: Bearer pf_live_…` (the `Bearer` prefix is required; the key alone is rejected with 401) |
| Envelope | `{ success, message, data }` |
| Error | HTTP >= 400 **or** `success: false` (can arrive with HTTP 200); the text is in `message` |
| Validate | `GET /validate` → `data.studioName` |

Error messages are complete sentences written for a human or a model to act on,
and are shown verbatim by the node.

## Dropdown RPCs

All `GET`, all answering `data: [{ id, value }]` where `id` is the key to send
and `value` the label. An empty array is a normal result.

| Endpoint | Used by |
|---|---|
| `/rpc/forms` | Trainee forms, Form → Send, trigger form filter |
| `/rpc/coaches` | Coach pickers, Task coach, filters |
| `/rpc/products` | Plan pickers (plans are "products" on the wire) |
| `/rpc/program-templates` | Program → Assign |
| `/rpc/tags` | Trainee → Get Many filter |

`/rpc/coaches` and `/rpc/tags` also back the Coach → Get Many and Tag → Get
Many operations, mapped to `{ id, name }`.

## Pagination

List endpoints take `limit` and `offset` query parameters and answer
`data: { items, offset, limit, hasMore }`. The next offset is
`offset + limit` as reported by the API. Make's help text puts the page cap at
200; the node never asks for more than that per request (**verify** the actual
cap; anything lower is harmless, the node just makes more requests).

## Trainees

| Operation | Request | Response `data` |
|---|---|---|
| Create | `POST /trainees` | `{ trainee, created }` |
| Update | `PATCH /trainees/{id}` | `{ trainee }` |
| Get | `GET /trainees/{id}` | `{ trainee, subscriptions[] }` |
| Find by phone | `GET /trainees/by-phone/{phone}` | `{ found, trainee }` (`trainee` null when not found) |
| Search | `GET /trainees/search?q&status&coachId&tag&createdAfter&updatedAfter` | page of trainees |
| Delete | `DELETE /trainees/{id}` body `{ confirm: true }` | `{ deleted }` |

Create body fields: `firstName`\*, `lastName`\*, `phone`\*, `externalId`,
`onDuplicatePhone` (`error` default, `return_existing`, `update`), `email`,
`productId`, `startedOn`, `priceAgorot`, `durationValue`, `durationUnit`
(`DAYS`, `MONTHS`), `coachIds[]` (first is primary), `tags[]`, `birthDate`,
`gender` (`MALE`, `FEMALE`, `OTHER`), `heightCm`, `weightKg`, `goal`,
`stepsGoal`, `waterGoalMl`, `onboardingFormId`, `updateFormId`,
`updateCadence` (`WEEKLY`, `BIWEEKLY`, `MONTHLY`), `sendWhatsappInvite`.

Update body: the same minus `externalId`, `onDuplicatePhone`, `productId`,
`priceAgorot`, `durationValue`, `durationUnit`, plus `notify`. Fields not sent
stay unchanged.

Trainee record: `id, name, phone, email, status, coachId, planName, productId,
startedOn, endsOn, weightKg, heightCm, goal, tags[], createdAt, updatedAt,
externalId` (`priceAgorot` also on create). Statuses: `ACTIVE`, `PAUSED`,
`CHURN_RISK`, `CHURNED`, `ARCHIVED`.

Phone numbers in any format resolve to the same trainee; the path parameter is
URL-encoded so a leading `+` survives.

## Plans / subscriptions

| Operation | Request | Response `data` |
|---|---|---|
| Assign / renew | `POST /trainees/{id}/subscription` body `{ productId*, startedOn, priceAgorot, durationValue, durationUnit, notify }` | `{ subscription: [...] }`, newest first |
| Freeze | `POST /trainees/{id}/subscription/freeze` body `{}` | `{ subscriptions[] }` |
| Reactivate | `POST /trainees/{id}/subscription/reactivate` body `{}` | `{ subscriptions[] }` |
| Cancel | `POST /trainees/{id}/subscription/cancel` body `{ subscriptionId }` | `{ subscriptions[] }` |
| List plans | `GET /products` | page of `{ id, name, priceAgorot, durationValue, durationUnit, tag }` |

Subscription record: `id, studioId, clientId, productId, planName, status,
startedOn, endsOn, priceAgorot, planFrozenOn, planRemainingDays, canceledOn,
createdAt, updatedAt`.

Make reads `data.subscription[1]` (Make arrays are 1-based) for the newly
created subscription, i.e. the first element. The node flattens that element
and keeps the full list under `subscriptions`; a single-object response is
tolerated too.

## Programs

| Operation | Request | Response `data` |
|---|---|---|
| Assign | `POST /trainees/{id}/programs/assign` body `{ templateId*, startsOn, notify, replaceExisting }` | `{ program }` |
| Trainee programs | `GET /trainees/{id}/programs` | page of `{ id, name, type, status, startsOn, endsOn, sourceTemplateId, createdAt }` |
| Templates | `GET /program-templates` | page of `{ id, name, type }` |

`replaceExisting: false` (default) skips the assignment when the trainee already
has an active program from the same template.

## Forms

| Operation | Request | Response `data` |
|---|---|---|
| Send | `POST /trainees/{id}/forms/assign` body `{ formTemplateId*, dueAt, prompt }` | `{ assignment: { id, status, dueAt, prompt, formTemplateId, createdAt } }` |
| Studio forms | `GET /forms` | page of `{ id, name, type }` |
| Trainee responses | `GET /trainees/{id}/form-responses` | page of `{ id, submittedAt, formTemplate: { id, name, type } }` |

`prompt` is limited to 500 characters.

## Tasks

| Operation | Request | Response `data` |
|---|---|---|
| Create | `POST /tasks` body `{ title*, clientId, detail, dueAt, priority, coachId }` | `{ task }` |
| Update | `PATCH /tasks/{id}` body `{ status, snoozeUntil, priority }` | `{ task }` |
| Search | `GET /tasks?status&clientId&coachId` | page of tasks |

Task record: `id, title, detail, status, priority, dueAt, clientId, coachId,
createdAt`. Statuses: `OPEN`, `SNOOZED`, `DONE`, `DISMISSED`. Priority 0 to 5.
`clientId` is the trainee ID.

## Messages and weights

| Operation | Request | Response `data` |
|---|---|---|
| Send in-app message | `POST /trainees/{id}/message` body `{ message* }` (up to 1000 chars) | `{ sent }` |
| Log weight | `POST /trainees/{id}/weights` body `{ weightKg*, recordedAt }` | `{ entry: { id, weightKg, recordedAt, source } }` |
| Weight history | `GET /trainees/{id}/weights` | page of `{ id, weightKg, recordedAt, source }` |

## Webhooks (trigger)

| | |
|---|---|
| Subscribe | `POST /hooks` body `{ event: "FORM_FILLED", targetUrl, formTemplateId? }` → `data.hook.id` |
| Unsubscribe | `DELETE /hooks/{hookId}` |
| List | none exposed (**verify**; if one appears, `checkExists` in the trigger should use it) |

Payload delivered to `targetUrl`:

```json
{
  "event": "form_filled",
  "occurredAt": "2026-09-02T09:00:00.000Z",
  "studioId": "…",
  "form": { "id": "…", "name": "…", "type": "INTAKE | CHECK_IN | ONE_TIME" },
  "trainee": { "id": "…", "name": "…", "firstName": "…", "lastName": "…", "phone": "…", "email": "…", "externalId": null },
  "response": {
    "id": "…", "assignmentId": "…", "formVersion": 2, "submittedAt": "…",
    "answers": { "<fieldKey>": "<value>" },
    "fields": [{ "key": "…", "label": "…", "type": "…", "value": "…" }]
  }
}
```

No signature header is documented (**verify**). Until one exists, the webhook
URL itself is the secret; n8n generates an unguessable path per workflow.

## Differences from the Perform MCP server

The hosted MCP server deliberately omits delete trainee, send message, freeze
and cancel plan because a model acts without a human checking each step. This
node exposes all of them, like the Make app does, because an n8n workflow is
built and reviewed by a person. If you expose the node to an AI Agent, consider
limiting which operations the agent may use.
