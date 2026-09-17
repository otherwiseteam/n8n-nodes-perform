# n8n-nodes-perform

An n8n community node for [Perform](https://perform-api.otherwise.co.il), the fitness-coaching platform: manage trainees, plans, programs, forms, tasks and weights from your n8n workflows, and start workflows the moment a trainee fills a form.

- **26 operations across 12 resources**: trainees, plans (subscriptions), programs, program templates, forms, form responses, tasks, in-app messages, weights, coaches, tags and the studio itself
- **Perform Trigger**: a webhook trigger that fires when a trainee fills a form (any form, or one you pick)
- **Real dropdowns, not hand-typed IDs.** Plans, program templates, forms, coaches and tags are loaded live from your studio
- **Pagination handled for you.** Every list operation has Return All / Limit and walks Perform's pages behind the scenes
- **Safety rails.** Deleting a trainee needs an explicit confirmation switch, and creating a trainee never sends a WhatsApp invite unless you turn it on
- **Precise errors.** Required fields are checked locally before a request is spent, and Perform's own error sentences are passed through verbatim
- Usable as an AI Agent tool

## Installation

In n8n, go to **Settings → Community Nodes → Install** and enter:

```
n8n-nodes-perform
```

For a manual install into a self-hosted instance:

```bash
cd ~/.n8n/nodes && npm install n8n-nodes-perform
```

## Credentials

Create a **Perform API** credential with two fields:

| Field | Value |
|---|---|
| API Key | The key from Perform → **Business settings → Integrations** |
| Base URL | Leave as-is unless pointing at a staging or local API |

The key starts with `pf_live_` and is shown only once, so copy it before closing the dialog. One key means one studio: every operation is scoped to it. Treat it like a password. Anyone holding it can read and change everything in that studio.

Click **Test** on the credential; a success also shows the studio the key belongs to. To revoke a key, delete it in Business settings → Integrations. It stops working immediately.

## Operations

| Resource | Operations |
|---|---|
| Trainee | Create · Delete · Find by Phone · Get · Get Many · Update |
| Plan | Assign (or renew) · Cancel · Freeze · Get Many · Reactivate |
| Program | Assign · Get Many (of a trainee) |
| Program Template | Get Many |
| Form | Send · Get Many |
| Form Response | Get Many (of a trainee) |
| Task | Create · Get Many · Update |
| Message | Send (in-app message to the trainee) |
| Weight | Log · Get Many (of a trainee) |
| Coach | Get Many |
| Tag | Get Many |
| Studio | Validate |

Phone numbers are accepted in any format (`0501234567`, `972501234567`, `+972-50-123-4567`). Perform normalises them server-side, so no formatting is required on your end.

### Trainee → Create

First name, last name and phone are required. Everything else, including the plan, coaches, tags, intake and check-in forms, lives under **Additional Fields**.

Two fields deserve attention when importing in bulk:

- **External ID**: a stable ID from the system the trainee comes from (a sheet row, a CRM contact, a payment). n8n retries failed items; with this set, a repeat call returns the trainee that already exists instead of creating a duplicate.
- **Send WhatsApp Invite** is always sent explicitly and defaults to off. It is the only contact a trainee receives on creation, so leave it off for imports unless you want every trainee on the list to get a message.

**On Duplicate Phone** decides what happens when the number is already in the studio: fail the item (default), return the existing trainee, or update it with the values sent.

### Trainee → Delete

Irreversible: it removes every workout, measurement and form response of the trainee. The node refuses to send the request until **Confirm Deletion** is switched on, and spends no request while it is off.

### Trainee → Find by Phone

A number nobody has returns `found: false` rather than an error, so you can route on it with an IF node. A match returns the trainee with `found: true`.

### Plan → Assign

Pick the plan from the dropdown. Plans that define no duration of their own (listed as "price per trainee") need **Duration** and **Duration Unit** under Additional Fields; if you leave them out, Perform replies with a message saying exactly what is missing. **Price (Agorot)** is in agorot, not shekels: `19000` = ₪190, and `0` is a valid price for a free plan.

The output is the newly created subscription, with the trainee's full subscription list under `subscriptions`. Freeze, Reactivate and Cancel return the updated `subscriptions` list; Cancel needs the **Subscription ID** taken from there or from Trainee → Get.

### Lists and pagination

Every Get Many operation has **Return All** and **Limit** (default 50). Perform serves up to 200 rows per page; the node requests only as many rows as the limit asks for and walks further pages when needed, emitting one n8n item per row.

## Trigger

**Perform Trigger** starts a workflow when a trainee fills a form. Leave **Form** empty to catch every form, or pick one to watch only that form. Only published, active forms are listed.

Each execution receives one item shaped like this:

```json
{
  "event": "form_filled",
  "occurredAt": "2026-09-02T09:00:00.000Z",
  "studioId": "…",
  "form": { "id": "…", "name": "Intake questionnaire", "type": "INTAKE" },
  "trainee": { "id": "…", "name": "Dana Cohen", "firstName": "Dana", "lastName": "Cohen", "phone": "0500000000", "email": "dana@example.com", "externalId": null },
  "response": {
    "id": "…",
    "assignmentId": "…",
    "formVersion": 2,
    "submittedAt": "2026-09-02T09:00:00.000Z",
    "answers": { "goal": "Lose weight", "injuries": null },
    "fields": [{ "key": "goal", "label": "What is your goal?", "type": "text", "value": "Lose weight" }]
  }
}
```

`answers` is keyed by field key; `fields` is the same data in question order with labels. Form types are `INTAKE`, `CHECK_IN` and `ONE_TIME`.

The webhook is registered with Perform when the workflow is activated and removed when it is deactivated. Perform exposes no endpoint to list webhooks, so the node relies on the ID it stored at registration: if a webhook was deleted on Perform's side, deactivate and reactivate the workflow to register a fresh one.

## Compatibility

Works across n8n versions. The nodes resolve their connection type defensively, because `NodeConnectionTypes` is a recent n8n-workflow export and reading it on an older install throws during class construction, which n8n reports as the misleading "Class could not be found".

## Known API behaviours

Properties of the upstream API, recorded here so they are not mistaken for bugs in this node.

- **Empty dropdowns are normal.** The RPC endpoints return `success: true` with an empty array rather than an error. An empty Tags or Program Templates dropdown means your studio has none yet.
- **`success: false` can arrive with HTTP 200.** The node checks the envelope, not just the status.
- **Errors are full sentences.** Perform writes messages such as "No trainee with id X exists in this studio. Use Search trainees or Find trainee by phone to get a valid id." The node shows them verbatim.
- **Notifications.** Plan → Assign, Program → Assign and Trainee → Update have a **Notify Trainee** switch (on by default on the server). Turn it off when tidying data in the background. Freeze always notifies the trainee and cannot be silenced.
- **Plans are "products" on the wire.** The dropdown and the Get Many operation read `/products`; the UI says Plan throughout.

## Development

```bash
npm install --ignore-scripts
npm run build
npm test
```

`--ignore-scripts` matters: n8n-workflow pulls in isolated-vm, a native module that needs Visual Studio build tools on Windows. Only its TypeScript types are needed here, so skipping the native build is safe.

`npm test` never touches the network. To verify the live API contract against a real studio, copy `.env.example` to `.env`, fill in your key, and run:

```bash
npm run smoke        # asserts the API contract: envelopes, {id,value}, paging, auth enforcement
npm run verify:live  # drives the node's own dropdown and read-only operation code
```

Both hit read-only endpoints only: nothing is created, changed or sent to a trainee. `verify:live` prints exactly what every dropdown will render in the UI, so you can check the node's behaviour without clicking through n8n.

### Testing in a real n8n

```bash
npm run build
mkdir -p ~/.n8n/nodes && cd ~/.n8n/nodes && npm install /path/to/this/repo
docker run -it --rm -p 5678:5678 -v "$HOME/.n8n:/home/node/.n8n" docker.n8n.io/n8nio/n8n
```

Then open http://localhost:5678. The trigger needs a public URL to receive webhooks; set `WEBHOOK_URL` on the container (for example to an ngrok address) when testing it locally.

## API notes

`docs/api-notes.md` records the contract this node was built against: every endpoint, body and response shape, taken from the Perform Make.com app definition, plus the points worth re-checking against the live API.

## Publishing

See `docs/PUBLISHING.md` for the full route to npm and n8n verification. Run `npm run scan` to check the package against n8n's real verification gate before releasing.

## License

MIT
