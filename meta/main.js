import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line), // or just +row.line
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));
  console.log(data);
  return data;
}
let xScale;
let yScale;

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      let first = lines[0];
      let { author, date, time, timezone, datetime } = first;
      let ret = {
        id: commit,
        url: 'https://github.com/vis-society/lab-7/commit/' + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, 'lines', {
        value: lines,
        // What other options do we need to set?
        // Hint: look up configurable, writable, and enumerable
      });

      return ret;
    });
}
function renderCommitInfo(data, commits) {
  const stats = d3.select('#stats');

  function addStat(label, value) {
    const card = stats.append('div').attr('class', 'stat-card');

    card.append('h2').text(label);
    card.append('p').text(value);
  }

  // Total LOC
  addStat('Total LOC', data.length);

  // Total commits
  addStat('Total commits', commits.length);

  // Number of files
  const fileLengths = d3.rollup(
    data,
    (lines) => lines.length,
    (d) => d.file
  );

  addStat('Number of files', fileLengths.size);

  // Average file length
  const avgFileLength = d3.mean(fileLengths.values());

  addStat('Average file length', avgFileLength.toFixed(2) + ' lines');

  // Maximum depth
  const maxDepth = d3.max(data, (d) => d.depth);

  addStat('Maximum depth', maxDepth);

  // Number of authors
  const authors = new Set(data.map((d) => d.author));

  addStat('Number of authors', authors.size);
}
function renderScatterPlot(data, commits) {
  // Put all the JS code of Steps inside this function
  const width = 1000;
  const height = 600;
  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');
  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([0, width])
    .nice();
  yScale = d3.scaleLinear().domain([0, 24]).range([height, 0]);
  const margin = { top: 10, right: 10, bottom: 30, left: 20 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };
  // Update scales with new ranges
  xScale.range([usableArea.left, usableArea.right]);
  yScale.range([usableArea.bottom, usableArea.top]);
  const colorScale = d3
    .scaleSqrt()
    .domain([0, 6, 12, 18, 24])
    .range([
      '#2166ac', // midnight blue
      '#67a9cf', // early morning blue
      '#fdae61', // midday orange
      '#67a9cf', // evening blue
      '#2166ac', // midnight blue
    ])
    .clamp(true);
  // Add gridlines BEFORE the axes
  const gridlines = svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`);
  // Create gridlines as an axis with no labels and full-width ticks
  gridlines.call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));
  gridlines
    .selectAll('.tick line')
    .attr('stroke', (d) => colorScale(d))
    .attr('stroke-opacity', 0.7);
  // Create the axes
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');
  // Add X axis
  svg
    .append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .attr('class', 'x-axis')
    .call(xAxis);
  // Add Y axis
  svg
    .append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .attr('class', 'y-axis')
    .call(yAxis);
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);
  const dots = svg.append('g').attr('class', 'dots');
  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3.scaleLinear().domain([minLines, maxLines]).range([5, 20]);
  dots
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7) // Add transparency for overlapping dots
    .on('mouseenter', (event, commit) => {
        renderTooltipContent(commit);
        updateTooltipVisibility(true);
        updateTooltipPosition(event);
    })
    .on('mouseleave', () => {
        updateTooltipVisibility(false);
    });
  createBrushSelector(svg);
  svg.selectAll('.dots, .overlay ~ *').raise();
}

function updateScatterPlot(data, filteredCommits) {
  // Select the SVG that already exists
  const svg = d3.select('#chart').select('svg');

  // Update the x-axis domain
  xScale.domain(
    d3.extent(filteredCommits, (d) => d.datetime)
  );

  // Update the existing x-axis
  const xAxis = d3.axisBottom(xScale);

  svg.select('g.x-axis')
    .call(xAxis);

  // Recalculate circle sizes
  const [minLines, maxLines] = d3.extent(
    filteredCommits,
    (d) => d.totalLines
  );

  const rScale = d3
    .scaleLinear()
    .domain([minLines, maxLines])
    .range([5, 20]);

  // Select existing dots
  const dots = svg.select('g.dots');

  // Sort by number of lines
  const sortedCommits = d3.sort(
    filteredCommits,
    (d) => -d.totalLines
  );

  // Update circles rather than creating a new SVG
  dots
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mouseleave', () => {
      updateTooltipVisibility(false);
    });
}
function renderTooltipContent(commit) {
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  const time = document.getElementById('commit-time');
  const author = document.getElementById('commit-author');
  const lines = document.getElementById('commit-lines');

  if (Object.keys(commit).length === 0) return;

  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString('en', {
    dateStyle: 'full',
  });

  time.textContent = commit.time;
  author.textContent = commit.author;
  lines.textContent = commit.totalLines;
}
function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.hidden = !isVisible;
}
function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.style.left = `${event.clientX+15}px`;
  tooltip.style.top = `${event.clientY-15}px`;
}
function createBrushSelector(svg) {
  svg.call(d3.brush().on('start brush end', brushed));
}
function brushed(event) {
  const selection = event.selection;
  d3.select('#chart')
  .selectAll('g.dots circle')
  .classed('selected', (d) =>
    isCommitSelected(selection, d)
  );
  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}
function isCommitSelected(selection, commit) {
  if (!selection) {
    return false;
  }
  const [x0, x1] = selection.map((d) => d[0]);
  const [y0, y1] = selection.map((d) => d[1]);
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);
  return x >= x0 && x <= x1 && y >= y0 && y <= y1; 
}
function renderSelectionCount(selection) {
  const selectedCommits = selection
    ? filteredCommits.filter((d) => isCommitSelected(selection, d))
    : [];

  const countElement = document.querySelector('#selection-count');
  countElement.hidden = selectedCommits.length === 0;
  countElement.textContent = `${
    selectedCommits.length || 'No'
  } commits selected`;

  return selectedCommits;
  
}
function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? filteredCommits.filter((d) => isCommitSelected(selection, d))
    : [];
  const container = document.getElementById('language-breakdown');

  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }
  const lines = selectedCommits.flatMap((d) => d.lines);

  // Use d3.rollup to count lines per language
  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type,
  );

  // Update DOM with breakdown
  container.innerHTML = '';
  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format('.1~%')(proportion);
    container.innerHTML += `
      <div class="stat-card">
        <h2>${language}</h2>
        <p>${count.toLocaleString()} lines</p>
        <span>${formatted} of selected lines</span>
      </div>
    `;
  }
}
const fileColors = d3.scaleOrdinal(d3.schemeTableau10);
function updateFileDisplay(filteredCommits) {
  // Get all lines from the filtered commits
  let lines = filteredCommits.flatMap((d) => d.lines);

  // Group lines by file
  let files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => {
      return { name, lines };
    })
    .sort((a, b) => b.lines.length - a.lines.length);

  // Create a container for each file
  let filesContainer = d3
    .select('#files')
    .selectAll('div.file')
    .data(files, (d) => d.name)
    .join(
      (enter) =>
        enter.append('div')
          .attr('class', 'file')
          .call((div) => {
            div.append('dt').append('code');
            div.select('dt').append('small');
            div.append('dd');
          })
    );

  // Display file names
  filesContainer
    .select('dt > code')
    .text((d) => d.name);

  // Display line counts
  filesContainer
    .select('dt > small')
    .text((d) => `${d.lines.length} lines`);

  // Create one dot for each line
  filesContainer
    .select('dd')
    .selectAll('div.loc')
    .data((d) => d.lines)
    .join('div')
    .attr('class', 'loc')
    .style('--color', (d) => fileColors(d.type));
}
function applyCommitFilter(maxTime) {
  commitMaxTime = maxTime;

  // Keep commits up to the selected time
  filteredCommits = commits.filter(
    (d) => d.datetime <= commitMaxTime
  );

  // Display the selected date
  document.querySelector('#commit-max-time').textContent =
    commitMaxTime.toLocaleString('en', {
      dateStyle: 'long',
      timeStyle: 'short',
    });

  // Update both visualizations
  updateScatterPlot(data, filteredCommits);
  updateFileDisplay(filteredCommits);
}
function onTimeSliderChange() {
  // Get the slider's value
  commitProgress = +document.querySelector('#commit-progress').value;

  // Convert percentage to a date
  const maxTime = timeScale.invert(commitProgress);

  // Update visualizations
  applyCommitFilter(maxTime);
}
function onStepEnter(response) {
  // Get the commit corresponding to the current story step
  const commit = response.element.__data__;

  // Update the slider to match this commit's date
  commitProgress = timeScale(commit.datetime);

  document.querySelector('#commit-progress').value =
    commitProgress;

  // Update the visualization
  applyCommitFilter(commit.datetime);
}

let data = await loadData();
let commits = processCommits(data).sort((a, b) => a.datetime - b.datetime);
let commitProgress = 100;
let timeScale = d3
  .scaleTime()
  .domain([
    d3.min(commits, (d) => d.datetime),
    d3.max(commits, (d) => d.datetime),
  ])
  .range([0, 100]);
let commitMaxTime = timeScale.invert(commitProgress);

let filteredCommits = commits;

// Initial rendering
renderCommitInfo(data, commits);
renderScatterPlot(data, commits);

// Initialize slider
document
  .querySelector('#commit-progress')
  .addEventListener('input', onTimeSliderChange);

onTimeSliderChange();

// Generate the scrollytelling narrative
d3.select('#scatter-story')
  .selectAll('.step')
  .data(commits)
  .join('div')
  .attr('class', 'step')
  .html(
    (d, i) => `
      On ${d.datetime.toLocaleString('en', {
        dateStyle: 'full',
        timeStyle: 'short',
      })},
      I made
      <a href="${d.url}" target="_blank">
        ${i > 0 ? 'another commit' : 'my first commit'}
      </a>.

      I edited ${d.totalLines} lines across
      ${
        d3.rollups(
          d.lines,
          (D) => D.length,
          (d) => d.file
        ).length
      } files.
    `
  );

// Initialize Scrollama
const scroller = scrollama();

scroller
  .setup({
    container: '#scrolly-1',
    step: '#scrolly-1 .step',
  })
  .onStepEnter(onStepEnter);

