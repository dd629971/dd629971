(() => {
  'use strict';

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

  let state = loadState();
  if (!state.selectedClientId && state.clients.length) {
    state.selectedClientId = state.clients[0].id;
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
        tr.appendChild(td);
      });
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

  // ---------- event wiring ----------

  function wireEvents() {
    document.getElementById('addClientBtn').addEventListener('click', () => {
      const name = prompt('New client name:');
      if (!name) return;
      const client = { id: uid(), name: name.trim(), rows: [], targets: {} };
      state.clients.push(client);
      state.selectedClientId = client.id;
      saveState();
      renderAll();
    });

    document.getElementById('renameClientBtn').addEventListener('click', () => {
      const client = currentClient();
      const name = prompt('Rename client:', client.name);
      if (!name) return;
      client.name = name.trim();
      saveState();
      renderAll();
    });

    document.getElementById('deleteClientBtn').addEventListener('click', () => {
      if (state.clients.length <= 1) {
        alert('At least one client must remain.');
        return;
      }
      const client = currentClient();
      if (!confirm(`Delete "${client.name}" and all its data? This cannot be undone.`)) return;
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

    document.getElementById('exportCsvBtn').addEventListener('click', () => {
      const client = currentClient();
      downloadFile(`${client.name.replace(/[^a-z0-9]+/gi, '-')}-roi-data.csv`, toCsv(client.rows), 'text/csv');
    });

    document.getElementById('importCsvInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const rows = parseCsv(String(reader.result));
        if (!rows.length) { alert('No rows found in that CSV.'); return; }
        currentClient().rows = rows;
        saveState();
        renderAll();
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    document.getElementById('exportJsonBtn').addEventListener('click', () => {
      downloadFile('roi-dashboard-backup.json', JSON.stringify(state, null, 2), 'application/json');
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
          alert('That file does not look like a valid dashboard backup.');
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

  if (!storageAvailable()) {
    const banner = document.getElementById('storageBanner');
    if (banner) banner.hidden = false;
  }
  applyStoredTheme();
  wireEvents();
  setLastUpdated();
  renderAll();
})();
