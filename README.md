# Live ROI Dashboard

A always-on, per-client ROI dashboard: cost per meeting, cost per qualified
opportunity, cost per $1 of pipeline generated, and cost per closed-won deal —
recalculated the instant a number changes, instead of surfacing in a quarterly
deck. The goal is to replace a client's vague "not sure this is working"
feeling with a number they'd have to beat.

## What it is

A single static web app, no backend, no build step, no dependencies:

- `index.html` — structure
- `style.css` — styling (light/dark, follows OS theme or a manual toggle)
- `app.js` — state, calculations, charts, import/export

Open `index.html` directly in a browser, or serve the folder with any static
file server. Data is stored in the browser's `localStorage`, scoped per
client, so it persists across reloads on the same machine/browser.

## Using it

- **Clients** (left panel): add, rename, or delete a client. Each client has
  its own independent data set.
- **Reporting range**: scope the KPI tiles and trend charts to the last 3, 6,
  or 12 periods, or all time. The underlying data table is unaffected by this
  filter — it's always the full data-entry surface.
- **Underlying data** (bottom table): one row per reporting period (weekly or
  monthly, your call — just be consistent within a client). Edit any cell and
  every KPI tile and chart recalculates immediately.
- **CSV import/export**: pull data in bulk from a spreadsheet, or export what's
  here. Column order: `period, spend, meetings, qualified_opps,
  pipeline_generated, closed_won_amount, closed_won_count`.
- **JSON export/import**: full backup of every client's full data set — use
  this to move the dashboard's data to another machine or hand it off.

Two sample clients are pre-loaded with illustrative data so the dashboard
isn't empty on first load. Delete them (or just add your own clients) once
you're plugging in real numbers.

## The four numbers

| Tile | Formula | Notes |
|---|---|---|
| Cost per meeting | `spend / meetings booked` | |
| Cost per qualified opportunity | `spend / qualified opportunities` | |
| Cost per $1 of pipeline generated | `spend / pipeline generated` | Subtext shows the inverse as an ROI multiple: "$X pipeline generated per $1 spent." |
| Cost per closed-won deal | `spend / closed-won deals` | Subtext shows blended cost per $1 of closed-won revenue, since closed-won lags the other three by a full sales cycle — treat it as the trailing confirmation metric, not the leading indicator. |

Each tile's headline number is **blended** over the selected reporting range
(sum of spend ÷ sum of the outcome across all included periods), which is
more stable than averaging period-by-period ratios. The delta underneath
compares the most recent single period to the one before it, so it still
reflects what just happened.

## Known limitations / next steps

This is deliberately the cheapest version that's still honest and useful —
manual/CSV entry, client-side only, single-browser storage. If it proves
its worth, the natural next steps (in rough order of effort) are:

1. **Move storage server-side** (even a simple database + REST API) so a
   client-facing view can be shared without exporting/importing JSON files
   between machines.
2. **Automate the inputs** by pulling spend from ad platforms (Google/Meta
   Ads APIs) and meetings/opportunities/pipeline/closed-won from the CRM
   (HubSpot, Salesforce, etc.) on a schedule, instead of typing them in.
3. **Add a read-only client-facing link** so the client can check the number
   themselves whenever they want, instead of waiting for you to send it.

None of that is required to make the core argument land: the dashboard as
built already turns "I'm not sure this is working" into a number that has to
be beaten, updated as often as you update the row.
