(() => {
  'use strict';

  // Captured before anything renders, so it's the pristine page template --
  // used to generate a standalone, single-client, read-only file for "Share client view".
  const PRISTINE_HTML = document.documentElement.outerHTML;

  const EMBED = window.__ROI_DASHBOARD_EMBED__ || null;
  const READ_ONLY = !!(EMBED && EMBED.readOnly && EMBED.client);

  const STORAGE_KEY = 'roi-dashboard/v1';
  const THEME_KEY = 'roi-dashboard/theme';

  const METRICS = [
    {
      id: 'costPerMeeting',
      label: 'Cost per meeting',
      color: 'var(--series-1)',
      num: (r) => r.spend,
      den: (r) => r.meetings,
      lowerIsBetter: true,
      sub: () => '',
    },
    {
      id: 'costPerQualifiedOpp',
      label: 'Cost per qualified opportunity',
      color: 'var(--series-2)',
      num: (r) => r.spend,
      den: (r) => r.qualifiedOpps,
      lowerIsBetter: true,
      sub: () => '',
    },
    {
      id: 'costPerPipelineDollar',
      label: 'Cost per $1 of pipeline generated',
      color: 'var(--series-3)',
      num: (r) => r.spend,
      den: (r) => r.pipelineGenerated,
      lowerIsBetter: true,
      currencyDigits: 2,
      sub: (spend, pipeline) => {
        if (!spend) return '';
        const roi = pipeline / spend;
        return Number.isFinite(roi) ? `$${roi.toFixed(2)} pipeline generated per $1 spent` : '';
      },
    },
    {
      id: 'costPerClosedWon',
      label: 'Cost per closed-won deal',
      color: 'var(--series-4)',
      num: (r) => r.spend,
      den: (r) => r.closedWonCount,
      lowerIsBetter: true,
      sub: (spend, _pipeline, closedWonAmount) => {
        if (!spend || !closedWonAmount) return '';
        const cents = spend / closedWonAmount;
        return Number.isFinite(cents) ? `$${cents.toFixed(2)} cost per $1 of closed-won revenue` : '';
      },
    },
  ];

  const RANGE_PRESETS = { 3: 3, 6: 6, 12: 12, all: Infinity };

  // ---------- state ----------

  // DEMO-SEED-START -- only reached from loadState()'s fallback, which read-only
  // client views never call. Stripped out of "Share client view" exports so no
  // other client's name ever appears, even in view-source.
  function seedClient(name, seedFn, targets) {
    const months = [
      '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07',
    ];
    return {
      id: uid(),
      name,
      targets,
      rows: months.map((m, i) => ({ id: uid(), period: m, ...seedFn(i) })),
    };
  }

  function defaultState() {
    return {
      selectedClientId: null,
      selectedRange: 'all',
      clients: [
        seedClient('Sample Client — Acme Co', (i) => ({
          spend: 12000 + i * 150,
          meetings: 18 + Math.round(i * 0.6),
          qualifiedOpps: 7 + Math.round(i * 0.4),
          pipelineGenerated: 60000 + i * 6000,
          closedWonAmount: 15000 + i * 2200,
          closedWonCount: 2 + (i % 4 === 0 ? 1 : 0),
        }), {
          costPerMeeting: 650,
          costPerQualifiedOpp: 1400,
          costPerPipelineDollar: 0.12,
          costPerClosedWon: 6000,
        }),
        seedClient('Sample Client — Northline Retail', (i) => ({
          spend: 8000 + (i % 3) * 400,
          meetings: 10 + (i % 5),
          qualifiedOpps: 4 + (i % 3),
          pipelineGenerated: 30000 + i * 1500,
          closedWonAmount: 9000 + i * 900,
          closedWonCount: 1 + (i % 3 === 0 ? 1 : 0),
        }), {
          costPerMeeting: 750,
          costPerQualifiedOpp: 1800,
          costPerPipelineDollar: 0.10,
          costPerClosedWon: 5000,
        }),
      ],
    };
  }
  // DEMO-SEED-END

  let state;
  if (READ_ONLY) {
    if (!EMBED.client.targets) EMBED.client.targets = {};
    state = { selectedClientId: EMBED.client.id, selectedRange: 'all', clients: [EMBED.client] };
  } else {
    state = loadState();
    if (!state.selectedClientId && state.clients.length) {
      state.selectedClientId = state.clients[0].id;
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.clients) || !parsed.clients.length) return defaultState();
      return parsed;
    } catch (e) {
      console.warn('Failed to load saved dashboard data, starting fresh.', e);
      return defaultState();
    }
  }

  function saveState() {
    if (READ_ONLY) { setLastUpdated(); return; }
    safeSetItem(STORAGE_KEY, JSON.stringify(state));
    setLastUpdated();
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function currentClient() {
    const client = state.clients.find((c) => c.id === state.selectedClientId) || state.clients[0];
    if (client && !client.targets) client.targets = {};
    return client;
  }

  // ---------- formatting ----------

  function formatCurrency(value, digits) {
    if (!Number.isFinite(value)) return '—';
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(digits ?? 0)}`;
  }

  function safeDivide(n, d) {
    if (!d || !Number.isFinite(n) || !Number.isFinite(d)) return NaN;
    return n / d;
  }

  function setLastUpdated() {
    const el = document.getElementById('lastUpdated');
    if (el) el.textContent = `Updated ${new Date().toLocaleString()}`;
  }

  // ---------- range scoping ----------

  function rowsInRange(rows) {
    const n = RANGE_PRESETS[state.selectedRange];
    if (!Number.isFinite(n)) return rows;
    return rows.slice(-n);
  }

  // ---------- rendering: clients ----------

  function renderClientList() {
    const ul = document.getElementById('clientList');
    ul.innerHTML = '';
    state.clients.forEach((c) => {
      const li = document.createElement('li');
      li.textContent = c.name;
      li.className = c.id === state.selectedClientId ? 'is-active' : '';
      li.addEventListener('click', () => {
        state.selectedClientId = c.id;
        saveState();
        renderAll();
      });
      ul.appendChild(li);
    });
  }

  // ---------- rendering: KPI tiles ----------

  function blendedValue(metric, rows) {
    return safeDivide(sum(rows, metric.num), sum(rows, metric.den));
  }

  function renderKPIs() {
    const client = currentClient();
    const grid = document.getElementById('kpiGrid');
    grid.innerHTML = '';
    const allRows = client.rows;
    const scoped = rowsInRange(allRows);

    METRICS.forEach((metric) => {
      const tile = document.createElement('div');
      tile.className = 'kpi-tile';

      const totalNum = sum(scoped, metric.num);
      const totalDen = sum(scoped, metric.den);
      const blended = safeDivide(totalNum, totalDen);

      const last = allRows[allRows.length - 1];
      const prev = allRows[allRows.length - 2];
      const lastVal = last ? safeDivide(metric.num(last), metric.den(last)) : NaN;
      const prevVal = prev ? safeDivide(metric.num(prev), metric.den(prev)) : NaN;

      let deltaHtml = '<span class="kpi-delta is-flat">Not enough data yet</span>';
      if (Number.isFinite(lastVal) && Number.isFinite(prevVal) && prevVal !== 0) {
        const pct = ((lastVal - prevVal) / prevVal) * 100;
        const isIncrease = pct > 0.05;
        const isDecrease = pct < -0.05;
        const isGood = metric.lowerIsBetter ? isDecrease : isIncrease;
        const isBad = metric.lowerIsBetter ? isIncrease : isDecrease;
        const cls = isGood ? 'is-good' : isBad ? 'is-bad' : 'is-flat';
        const arrow = pct > 0.05 ? '↑' : pct < -0.05 ? '↓' : '→';
        deltaHtml = `<span class="kpi-delta ${cls}">${arrow} ${Math.abs(pct).toFixed(0)}% vs prior period</span>`;
      }

      const spark = renderSparkline(allRows, metric);

      const subText = metric.sub(totalNum,
        metric.id === 'costPerPipelineDollar' ? sum(scoped, (r) => r.pipelineGenerated) : undefined,
        metric.id === 'costPerClosedWon' ? sum(scoped, (r) => r.closedWonAmount) : undefined);

      tile.innerHTML = `
        <p class="kpi-label">${escapeHtml(metric.label)}</p>
        <p class="kpi-value">${formatCurrency(blended, metric.currencyDigits ?? 0)}</p>
        ${subText ? `<p class="kpi-sub">${escapeHtml(subText)}</p>` : ''}
        <div class="kpi-delta-row"></div>
      `;
      const deltaRow = tile.querySelector('.kpi-delta-row');
      const deltaSpan = document.createElement('div');
      deltaSpan.innerHTML = deltaHtml;
      deltaRow.appendChild(deltaSpan.firstChild);
      deltaRow.appendChild(spark);

      grid.appendChild(tile);
    });
  }

  // ---------- rendering: target scorecard ----------

  const STATUS_BUCKETS = [
    { id: 'exceeding', label: 'Exceeding target', dotClass: 'is-good', cardClass: 'is-good' },
    { id: 'onTarget', label: 'On target', dotClass: '', cardClass: '' },
    { id: 'below', label: 'Below target', dotClass: 'is-critical', cardClass: 'is-critical' },
  ];

  function bucketFor(current, target) {
    if (!Number.isFinite(current) || !target) return null;
    const ratio = current / target;
    if (ratio <= 0.95) return 'exceeding';
    if (ratio > 1.05) return 'below';
    return 'onTarget';
  }

  function renderTargetInputs() {
    const client = currentClient();
    const wrap = document.getElementById('targetInputs');
    wrap.innerHTML = '';
    if (READ_ONLY) { wrap.hidden = true; return; }

    METRICS.forEach((metric) => {
      const field = document.createElement('div');
      field.className = 'target-input-field';
      const label = document.createElement('label');
      label.textContent = `${metric.label} target`;
      const inputWrap = document.createElement('div');
      inputWrap.className = 'input-wrap';
      const prefix = document.createElement('span');
      prefix.textContent = '$';
      const input = document.createElement('input');
      input.type = 'number';
      input.step = 'any';
      input.placeholder = 'not set';
      input.value = client.targets[metric.id] ?? '';
      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        if (Number.isFinite(v) && v > 0) {
          client.targets[metric.id] = v;
        } else {
          delete client.targets[metric.id];
        }
        saveState();
        renderStatusBoard();
      });
      inputWrap.appendChild(prefix);
      inputWrap.appendChild(input);
      field.appendChild(label);
      field.appendChild(inputWrap);
      wrap.appendChild(field);
    });
  }

  function renderStatusBoard() {
    const client = currentClient();
    const board = document.getElementById('statusBoard');
    board.innerHTML = '';
    const scoped = rowsInRange(client.rows);

    const withTargets = METRICS.map((metric) => {
      const current = blendedValue(metric, scoped);
      const target = client.targets[metric.id];
      return { metric, current, target, bucket: bucketFor(current, target) };
    });

    STATUS_BUCKETS.forEach((bucketDef) => {
      const col = document.createElement('div');
      col.className = 'status-column';
      const items = withTargets.filter((m) => m.bucket === bucketDef.id);

      col.innerHTML = `
        <div class="status-column-head">
          <span class="status-dot ${escapeHtml(bucketDef.dotClass)}"></span>
          <span>${escapeHtml(bucketDef.label)}</span>
          <span class="status-count">${items.length}</span>
        </div>
      `;

      if (!items.length) {
        const empty = document.createElement('p');
        empty.className = 'status-empty';
        empty.textContent = 'Nothing here yet.';
        col.appendChild(empty);
      } else {
        items.forEach(({ metric, current, target }) => {
          const card = document.createElement('div');
          card.className = `status-card ${bucketDef.cardClass}`;
          card.innerHTML = `
            <p class="status-card-label">${escapeHtml(metric.label)}</p>
            <p class="status-card-value">${formatCurrency(current, metric.currencyDigits ?? 0)}</p>
            <p class="status-card-target">Target: ${formatCurrency(target, metric.currencyDigits ?? 0)}</p>
          `;
          col.appendChild(card);
        });
      }

      board.appendChild(col);
    });

    const untargeted = withTargets.filter((m) => !m.target).length;
    if (untargeted) {
      const note = document.createElement('p');
      note.className = 'status-empty';
      note.style.gridColumn = '1 / -1';
      note.textContent = untargeted > 1
        ? `${untargeted} metrics still need a target set above to appear on the scorecard.`
        : '1 metric still needs a target set above to appear on the scorecard.';
      board.appendChild(note);
    }
  }

  function sum(rows, fn) {
    return rows.reduce((acc, r) => {
      const v = fn(r);
      return acc + (Number.isFinite(v) ? v : 0);
    }, 0);
  }

  function renderSparkline(rows, metric) {
    const svgNs = 'http://www.w3.org/2000/svg';
    const w = 72, h = 24;
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.classList.add('kpi-sparkline');

    const pts = rows.slice(-12).map((r) => safeDivide(metric.num(r), metric.den(r)))
      .filter((v) => Number.isFinite(v));
    if (pts.length < 2) return svg;

    const min = Math.min(...pts), max = Math.max(...pts);
    const range = max - min || 1;
    const step = w / (pts.length - 1);
    const coords = pts.map((v, i) => [i * step, h - 2 - ((v - min) / range) * (h - 4)]);

    const path = document.createElementNS(svgNs, 'polyline');
    path.setAttribute('points', coords.slice(0, -1).map((p) => p.join(',')).join(' ') + ' ' + coords[coords.length - 1].join(','));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'var(--text-muted)');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);

    const [lx, ly] = coords[coords.length - 1];
    const dot = document.createElementNS(svgNs, 'circle');
    dot.setAttribute('cx', lx);
    dot.setAttribute('cy', ly);
    dot.setAttribute('r', 3);
    dot.setAttribute('fill', metric.color);
    svg.appendChild(dot);

    return svg;
  }

  // ---------- rendering: charts ----------

  function renderCharts() {
    const client = currentClient();
    const grid = document.getElementById('chartsGrid');
    grid.innerHTML = '';
    const rows = rowsInRange(client.rows);

    METRICS.forEach((metric) => {
      const card = document.createElement('div');
      card.className = 'chart-card';
      const title = document.createElement('p');
      title.className = 'chart-title';
      title.textContent = metric.label + ' — by period';
      card.appendChild(title);

      const points = rows
        .map((r) => ({ period: r.period, value: safeDivide(metric.num(r), metric.den(r)) }))
        .filter((p) => Number.isFinite(p.value));

      if (points.length < 2) {
        const empty = document.createElement('div');
        empty.className = 'chart-empty';
        empty.textContent = 'Add at least two periods with data to see a trend.';
        card.appendChild(empty);
      } else {
        card.appendChild(buildLineChart(points, metric));
      }
      grid.appendChild(card);
    });
  }

  function buildLineChart(points, metric) {
    const svgNs = 'http://www.w3.org/2000/svg';
    const w = 480, h = 160;
    const padL = 44, padR = 12, padT = 12, padB = 24;
    const plotW = w - padL - padR, plotH = h - padT - padB;

    const values = points.map((p) => p.value);
    let min = Math.min(...values, 0);
    let max = Math.max(...values);
    if (min === max) { max = min + 1; }
    const niceMax = niceCeil(max);

    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', h);
    svg.style.display = 'block';
    svg.style.overflow = 'visible';

    const xAt = (i) => padL + (i / (points.length - 1)) * plotW;
    const yAt = (v) => padT + plotH - ((v - min) / (niceMax - min || 1)) * plotH;

    // gridlines (0, mid, max)
    [0, 0.5, 1].forEach((f) => {
      const val = min + (niceMax - min) * f;
      const y = yAt(val);
      const line = document.createElementNS(svgNs, 'line');
      line.setAttribute('x1', padL);
      line.setAttribute('x2', w - padR);
      line.setAttribute('y1', y);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', 'var(--gridline)');
      line.setAttribute('stroke-width', '1');
      svg.appendChild(line);

      const label = document.createElementNS(svgNs, 'text');
      label.setAttribute('x', padL - 6);
      label.setAttribute('y', y + 4);
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('fill', 'var(--text-muted)');
      label.setAttribute('font-size', '10');
      label.textContent = formatCurrency(val, val < 10 ? 2 : 0);
      svg.appendChild(label);
    });

    // line
    const coords = points.map((p, i) => [xAt(i), yAt(p.value)]);
    const poly = document.createElementNS(svgNs, 'polyline');
    poly.setAttribute('points', coords.map((c) => c.join(',')).join(' '));
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke', metric.color);
    poly.setAttribute('stroke-width', '2');
    poly.setAttribute('stroke-linecap', 'round');
    poly.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(poly);

    // end marker + direct label
    const [ex, ey] = coords[coords.length - 1];
    const ring = document.createElementNS(svgNs, 'circle');
    ring.setAttribute('cx', ex);
    ring.setAttribute('cy', ey);
    ring.setAttribute('r', 6);
    ring.setAttribute('fill', 'var(--surface-1)');
    svg.appendChild(ring);
    const dot = document.createElementNS(svgNs, 'circle');
    dot.setAttribute('cx', ex);
    dot.setAttribute('cy', ey);
    dot.setAttribute('r', 4);
    dot.setAttribute('fill', metric.color);
    svg.appendChild(dot);

    const endLabel = document.createElementNS(svgNs, 'text');
    endLabel.setAttribute('x', Math.min(ex + 6, w - padR - 30));
    endLabel.setAttribute('y', ey - 8 < padT ? ey + 16 : ey - 8);
    endLabel.setAttribute('fill', 'var(--text-primary)');
    endLabel.setAttribute('font-size', '11');
    endLabel.setAttribute('font-weight', '600');
    endLabel.textContent = formatCurrency(points[points.length - 1].value, points[points.length - 1].value < 10 ? 2 : 0);
    svg.appendChild(endLabel);

    // crosshair + hit layer
    const crosshair = document.createElementNS(svgNs, 'line');
    crosshair.setAttribute('y1', padT);
    crosshair.setAttribute('y2', h - padB);
    crosshair.setAttribute('stroke', 'var(--baseline)');
    crosshair.setAttribute('stroke-width', '1');
    crosshair.setAttribute('visibility', 'hidden');
    svg.appendChild(crosshair);

    const hit = document.createElementNS(svgNs, 'rect');
    hit.setAttribute('x', padL);
    hit.setAttribute('y', padT);
    hit.setAttribute('width', plotW);
    hit.setAttribute('height', plotH);
    hit.setAttribute('fill', 'transparent');
    svg.appendChild(hit);

    const tooltip = document.getElementById('chartTooltip');

    function showAt(clientX, svgX) {
      const idx = Math.round(((svgX - padL) / plotW) * (points.length - 1));
      const clamped = Math.max(0, Math.min(points.length - 1, idx));
      const [px] = coords[clamped];
      crosshair.setAttribute('x1', px);
      crosshair.setAttribute('x2', px);
      crosshair.setAttribute('visibility', 'visible');

      const p = points[clamped];
      tooltip.hidden = false;
      tooltip.innerHTML = '';
      const strong = document.createElement('strong');
      strong.textContent = formatCurrency(p.value, p.value < 10 ? 2 : 0);
      const line = document.createElement('div');
      line.textContent = p.period;
      tooltip.appendChild(strong);
      tooltip.appendChild(line);
    }

    hit.addEventListener('pointermove', (e) => {
      const rect = svg.getBoundingClientRect();
      const scaleX = w / rect.width;
      const svgX = (e.clientX - rect.left) * scaleX;
      showAt(e.clientX, svgX);
      tooltip.style.left = `${e.clientX + 14}px`;
      tooltip.style.top = `${e.clientY + 14}px`;
    });
    hit.addEventListener('pointerleave', () => {
      crosshair.setAttribute('visibility', 'hidden');
      tooltip.hidden = true;
    });

    return svg;
  }

  function niceCeil(v) {
    if (v <= 0) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    const norm = v / mag;
    let nice;
    if (norm <= 1) nice = 1;
    else if (norm <= 2) nice = 2;
    else if (norm <= 5) nice = 5;
    else nice = 10;
    return nice * mag;
  }

  // ---------- rendering: data table ----------

  const FIELD_DEFS = [
    { key: 'period', type: 'text' },
    { key: 'spend', type: 'number' },
    { key: 'meetings', type: 'number' },
    { key: 'qualifiedOpps', type: 'number' },
    { key: 'pipelineGenerated', type: 'number' },
    { key: 'closedWonAmount', type: 'number' },
    { key: 'closedWonCount', type: 'number' },
  ];

  function renderTable() {
    const client = currentClient();
    const tbody = document.getElementById('dataTableBody');
    tbody.innerHTML = '';

    client.rows.forEach((row) => {
      const tr = document.createElement('tr');
      FIELD_DEFS.forEach((f) => {
        const td = document.createElement('td');
        if (READ_ONLY) {
          const span = document.createElement('span');
          span.className = 'read-only-cell';
          const value = row[f.key];
          span.textContent = f.type === 'number' ? (Number.isFinite(value) ? value.toLocaleString() : '0') : String(value ?? '');
          td.appendChild(span);
        } else {
          const input = document.createElement('input');
          input.type = f.type === 'number' ? 'number' : 'text';
          if (f.type === 'number') input.step = 'any';
          input.value = row[f.key] ?? (f.type === 'number' ? 0 : '');
          input.addEventListener('input', () => {
            row[f.key] = f.type === 'number' ? (parseFloat(input.value) || 0) : input.value;
            saveState();
            renderKPIs();
            renderCharts();
          });
          td.appendChild(input);
        }
        tr.appendChild(td);
      });

      if (!READ_ONLY) {
        const actionTd = document.createElement('td');
        const delBtn = document.createElement('button');
        delBtn.className = 'row-delete';
        delBtn.type = 'button';
        delBtn.title = 'Delete period';
        delBtn.textContent = '✕';
        delBtn.addEventListener('click', () => {
          client.rows = client.rows.filter((r) => r.id !== row.id);
          saveState();
          renderAll();
        });
        actionTd.appendChild(delBtn);
        tr.appendChild(actionTd);
      }

      tbody.appendChild(tr);
    });
  }

  // ---------- CSV / JSON import-export ----------

  function toCsv(rows) {
    const header = ['period', 'spend', 'meetings', 'qualified_opps', 'pipeline_generated', 'closed_won_amount', 'closed_won_count'];
    const lines = [header.join(',')];
    rows.forEach((r) => {
      lines.push([r.period, r.spend, r.meetings, r.qualifiedOpps, r.pipelineGenerated, r.closedWonAmount, r.closedWonCount]
        .map(csvEscape).join(','));
    });
    return lines.join('\n');
  }

  function csvEscape(v) {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
    if (!lines.length) return [];
    const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    const idx = (name) => header.indexOf(name);
    return lines.slice(1).map((line) => {
      const cells = splitCsvLine(line);
      const num = (name) => parseFloat(cells[idx(name)]) || 0;
      return {
        id: uid(),
        period: cells[idx('period')] ?? '',
        spend: num('spend'),
        meetings: num('meetings'),
        qualifiedOpps: num('qualified_opps'),
        pipelineGenerated: num('pipeline_generated'),
        closedWonAmount: num('closed_won_amount'),
        closedWonCount: num('closed_won_count'),
      };
    });
  }

  function splitCsvLine(line) {
    const out = [];
    let cur = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else { cur += c; }
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ',') { out.push(cur); cur = ''; }
        else cur += c;
      }
    }
    out.push(cur);
    return out;
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ---------- misc ----------

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function renderAll() {
    renderClientList();
    renderKPIs();
    renderTargetInputs();
    renderStatusBoard();
    renderCharts();
    renderTable();
    document.querySelectorAll('#rangePresets .chip').forEach((chip) => {
      chip.classList.toggle('is-selected', chip.dataset.range === String(state.selectedRange));
    });
  }

  // ---------- modal (replaces window.prompt/confirm/alert, which sandboxed embeds can silently disable) ----------

  function openModal({ title, message, showInput = false, inputValue = '', confirmLabel = 'OK', cancelLabel = null, danger = false }) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('modalOverlay');
      const box = document.getElementById('modalBox');
      const titleEl = document.getElementById('modalTitle');
      const messageEl = document.getElementById('modalMessage');
      const inputEl = document.getElementById('modalInput');
      const textareaEl = document.getElementById('modalTextarea');
      const actionsEl = document.getElementById('modalActions');

      box.classList.remove('is-wide');
      textareaEl.hidden = true;
      titleEl.textContent = title || '';
      messageEl.textContent = message || '';
      messageEl.hidden = !message;
      inputEl.hidden = !showInput;
      inputEl.value = inputValue;

      actionsEl.innerHTML = '';

      function close(result) {
        overlay.hidden = true;
        document.removeEventListener('keydown', onKeydown);
        resolve(result);
      }

      function onKeydown(e) {
        if (e.key === 'Escape') close(showInput ? null : false);
        if (e.key === 'Enter' && showInput) close(inputEl.value.trim() || null);
      }

      if (cancelLabel) {
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-ghost btn-small';
        cancelBtn.type = 'button';
        cancelBtn.textContent = cancelLabel;
        cancelBtn.addEventListener('click', () => close(showInput ? null : false));
        actionsEl.appendChild(cancelBtn);
      }

      const confirmBtn = document.createElement('button');
      confirmBtn.className = danger ? 'btn btn-small btn-critical' : 'btn btn-small';
      confirmBtn.type = 'button';
      confirmBtn.textContent = confirmLabel;
      confirmBtn.addEventListener('click', () => close(showInput ? (inputEl.value.trim() || null) : true));
      actionsEl.appendChild(confirmBtn);

      overlay.hidden = false;
      document.addEventListener('keydown', onKeydown);
      if (showInput) { inputEl.focus(); inputEl.select(); } else { confirmBtn.focus(); }
    });
  }

  function showPrompt(title, defaultValue = '') {
    return openModal({ title, showInput: true, inputValue: defaultValue, confirmLabel: 'Save', cancelLabel: 'Cancel' });
  }

  function showConfirm(title, message) {
    return openModal({ title, message, confirmLabel: 'Delete', cancelLabel: 'Cancel', danger: true });
  }

  function showAlert(title, message) {
    return openModal({ title, message, confirmLabel: 'OK' });
  }

  // For output the user needs to get OUT of the page (e.g. a generated file).
  // Some hosts (this Artifact preview included) silently block programmatic
  // downloads, same as they can block localStorage or native dialogs -- so
  // this always shows the content in a selectable textarea as a guaranteed
  // fallback alongside the normal download attempt, rather than assuming the
  // download worked.
  function showTextExport({ title, message, filename, content, mime }) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('modalOverlay');
      const box = document.getElementById('modalBox');
      const titleEl = document.getElementById('modalTitle');
      const messageEl = document.getElementById('modalMessage');
      const inputEl = document.getElementById('modalInput');
      const textareaEl = document.getElementById('modalTextarea');
      const actionsEl = document.getElementById('modalActions');

      box.classList.add('is-wide');
      titleEl.textContent = title || '';
      messageEl.textContent = message || '';
      messageEl.hidden = !message;
      inputEl.hidden = true;
      textareaEl.hidden = false;
      textareaEl.value = content;
      actionsEl.innerHTML = '';

      function close() {
        overlay.hidden = true;
        box.classList.remove('is-wide');
        textareaEl.hidden = true;
        textareaEl.value = '';
        document.removeEventListener('keydown', onKeydown);
        resolve();
      }
      function onKeydown(e) {
        if (e.key === 'Escape') close();
      }

      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'btn btn-ghost btn-small';
      downloadBtn.type = 'button';
      downloadBtn.textContent = 'Download file';
      downloadBtn.addEventListener('click', () => downloadFile(filename, content, mime));
      actionsEl.appendChild(downloadBtn);

      // A different browser permission than downloads -- some hosts that block
      // one allow the other, so this is a second independent attempt, not a
      // guaranteed fix. "Select all" (below) is the one guaranteed path: it's
      // just a DOM selection, nothing a host can permission-gate.
      if (navigator.clipboard && navigator.clipboard.writeText) {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn btn-ghost btn-small';
        copyBtn.type = 'button';
        copyBtn.textContent = 'Copy to clipboard';
        copyBtn.addEventListener('click', async () => {
          const original = copyBtn.textContent;
          try {
            await navigator.clipboard.writeText(content);
            copyBtn.textContent = 'Copied!';
          } catch (e) {
            copyBtn.textContent = 'Couldn’t copy — use Select all';
          }
          setTimeout(() => { copyBtn.textContent = original; }, 1800);
        });
        actionsEl.appendChild(copyBtn);
      }

      const selectBtn = document.createElement('button');
      selectBtn.className = 'btn btn-small';
      selectBtn.type = 'button';
      selectBtn.textContent = 'Select all';
      selectBtn.addEventListener('click', () => { textareaEl.focus(); textareaEl.select(); });
      actionsEl.appendChild(selectBtn);

      const closeBtn = document.createElement('button');
      closeBtn.className = 'btn btn-ghost btn-small';
      closeBtn.type = 'button';
      closeBtn.textContent = 'Close';
      closeBtn.addEventListener('click', close);
      actionsEl.appendChild(closeBtn);

      overlay.hidden = false;
      document.addEventListener('keydown', onKeydown);
      textareaEl.focus();
      textareaEl.select();
    });
  }

  // ---------- event wiring ----------

  function wireEvents() {
    document.getElementById('addClientBtn').addEventListener('click', async () => {
      const name = await showPrompt('New client name');
      if (!name) return;
      const client = { id: uid(), name: name.trim(), rows: [], targets: {} };
      state.clients.push(client);
      state.selectedClientId = client.id;
      saveState();
      renderAll();
    });

    document.getElementById('renameClientBtn').addEventListener('click', async () => {
      const client = currentClient();
      const name = await showPrompt('Rename client', client.name);
      if (!name) return;
      client.name = name.trim();
      saveState();
      renderAll();
    });

    document.getElementById('deleteClientBtn').addEventListener('click', async () => {
      if (state.clients.length <= 1) {
        await showAlert('Can’t delete', 'At least one client must remain.');
        return;
      }
      const client = currentClient();
      const ok = await showConfirm('Delete client', `Delete "${client.name}" and all its data? This cannot be undone.`);
      if (!ok) return;
      state.clients = state.clients.filter((c) => c.id !== client.id);
      state.selectedClientId = state.clients[0].id;
      saveState();
      renderAll();
    });

    document.getElementById('rangePresets').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      state.selectedRange = chip.dataset.range === 'all' ? 'all' : Number(chip.dataset.range);
      saveState();
      renderAll();
    });

    document.getElementById('addRowBtn').addEventListener('click', () => {
      const client = currentClient();
      client.rows.push({
        id: uid(), period: '', spend: 0, meetings: 0, qualifiedOpps: 0,
        pipelineGenerated: 0, closedWonAmount: 0, closedWonCount: 0,
      });
      saveState();
      renderAll();
    });

    document.getElementById('exportCsvBtn').addEventListener('click', async () => {
      const client = currentClient();
      const filename = `${client.name.replace(/[^a-z0-9]+/gi, '-')}-roi-data.csv`;
      const csv = toCsv(client.rows);
      downloadFile(filename, csv, 'text/csv');
      await showTextExport({
        title: 'CSV ready',
        message: `Your browser should have started downloading "${filename}". If nothing happened, click "Select all" below, copy it, and paste it wherever you need it (including back to me in chat).`,
        filename,
        content: csv,
        mime: 'text/csv',
      });
    });

    document.getElementById('importCsvInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const rows = parseCsv(String(reader.result));
        if (!rows.length) { showAlert('Nothing imported', 'No rows found in that CSV.'); return; }
        currentClient().rows = rows;
        saveState();
        renderAll();
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    document.getElementById('exportJsonBtn').addEventListener('click', async () => {
      const filename = 'roi-dashboard-backup.json';
      const json = JSON.stringify(state, null, 2);
      downloadFile(filename, json, 'application/json');
      await showTextExport({
        title: 'Backup ready',
        message: `Your browser should have started downloading "${filename}". If nothing happened, click "Select all" below, copy it, and paste it wherever you need it (including back to me in chat).`,
        filename,
        content: json,
        mime: 'application/json',
      });
    });

    document.getElementById('importJsonInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          if (!parsed || !Array.isArray(parsed.clients)) throw new Error('bad shape');
          state = parsed;
          if (!state.selectedClientId && state.clients.length) state.selectedClientId = state.clients[0].id;
          saveState();
          renderAll();
        } catch (err) {
          showAlert('Import failed', 'That file does not look like a valid dashboard backup.');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    document.getElementById('themeToggle').addEventListener('click', () => {
      const root = document.documentElement;
      const current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light-or-auto';
      const next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      safeSetItem(THEME_KEY, next);
    });

    const shareBtn = document.getElementById('shareClientBtn');
    if (shareBtn) {
      shareBtn.addEventListener('click', async () => {
        shareBtn.disabled = true;
        const originalLabel = shareBtn.textContent;
        shareBtn.textContent = 'Building…';
        let html, filename;
        try {
          const client = currentClient();
          const clientCopy = JSON.parse(JSON.stringify(client));
          html = await buildStandaloneClientHtml(clientCopy);
          filename = `${client.name.replace(/[^a-z0-9]+/gi, '-')}-client-view.html`;
          downloadFile(filename, html, 'text/html');
        } catch (e) {
          showAlert('Couldn’t build client view', 'Something went wrong generating the file. Try again, or check the console for details.');
          console.error(e);
          shareBtn.disabled = false;
          shareBtn.textContent = originalLabel;
          return;
        }
        // Reset the button before the fallback modal, which can stay open
        // indefinitely -- it's a courtesy copy, not part of "building".
        shareBtn.disabled = false;
        shareBtn.textContent = originalLabel;
        await showTextExport({
          title: 'Client view ready',
          message: `Your browser should have started downloading "${filename}". If nothing happened (some embedded previews block that), click "Select all" below, copy it, and paste it into a new file saved with that name.`,
          filename,
          content: html,
          mime: 'text/html',
        });
      });
    }
  }

  // ---------- read-only client view ----------

  async function buildStandaloneClientHtml(client) {
    let html = PRISTINE_HTML;

    // Every .replace() below uses a replacer FUNCTION, never a plain string --
    // a string replacement is subject to special $-patterns ($&, $', $1, ...),
    // and app.js's own source is full of literal "$" (e.g. the target-input
    // prefix '$'), which would otherwise get misread as one of those patterns
    // and silently truncate/corrupt the output.

    const linkMatch = html.match(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/i);
    if (linkMatch) {
      const cssText = await fetch(linkMatch[1]).then((r) => r.text());
      html = html.replace(linkMatch[0], () => `<style>\n${cssText}\n</style>`);
    }

    const scriptMatch = html.match(/<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/i);
    if (scriptMatch) {
      const jsText = await fetch(scriptMatch[1]).then((r) => r.text());
      // Also escaped so this app.js source, once inlined into a real script
      // element, doesn't hand the HTML parser a literal closing tag mid-string
      // and truncate the script early -- see the note on embedScript below.
      html = html.replace(scriptMatch[0], () => `<script>\n${jsText}\n<\/script>`);
    }

    // Strip the demo-seed block so no other client's name/numbers ship in this file at all.
    html = html.replace(
      /\/\/ DEMO-SEED-START[\s\S]*?\/\/ DEMO-SEED-END\n?/,
      () => '// (demo seed data removed for this client-facing view)\n'
    );

    html = html.replace(/<title>.*?<\/title>/i, () => `<title>${escapeHtml(client.name)} — ROI Dashboard</title>`);

    // Escaped for the same reason as above: this template lives inside app.js's
    // own source, which gets inlined into a script element -- an unescaped
    // closing script tag here would end that element early and corrupt every
    // file this function ever builds, including itself.
    const embedScript = `<script>window.__ROI_DASHBOARD_EMBED__ = ${JSON.stringify({ readOnly: true, client })};<\/script>`;
    html = html.replace('<body>', () => `<body>\n${embedScript}`);

    return html;
  }

  function applyReadOnlyUI() {
    const client = currentClient();
    const panel = document.querySelector('.clients-panel');
    if (panel) panel.hidden = true;
    const layout = document.querySelector('.layout');
    if (layout) layout.classList.add('layout-readonly');

    const h1 = document.querySelector('.topbar h1');
    if (h1) h1.textContent = `${client.name} — ROI Dashboard`;
    const tagline = document.querySelector('.tagline');
    if (tagline) tagline.textContent = 'Updated the moment new numbers come in — not in a quarterly deck.';

    ['addRowBtn'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });
    const importCsvLabel = document.getElementById('importCsvInput')?.closest('label');
    if (importCsvLabel) importCsvLabel.hidden = true;

    const banner = document.getElementById('storageBanner');
    if (banner) banner.hidden = true;
  }

  function applyStoredTheme() {
    const stored = safeGetItem(THEME_KEY);
    if (stored === 'dark' || stored === 'light') {
      document.documentElement.setAttribute('data-theme', stored);
    }
  }

  function safeGetItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function safeSetItem(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  function storageAvailable() {
    try {
      const testKey = '__roi_dashboard_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------- init ----------

  if (!READ_ONLY && !storageAvailable()) {
    const banner = document.getElementById('storageBanner');
    if (banner) banner.hidden = false;
  }
  applyStoredTheme();
  wireEvents();
  if (READ_ONLY) applyReadOnlyUI();
  setLastUpdated();
  renderAll();
})();
