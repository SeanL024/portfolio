import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
let query = '';
let selectedYear = null;
const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');
projectsTitle.textContent = `${projects.length} Projects`;


let searchInput = document.querySelector('.searchBar');
searchInput.addEventListener('input', (event) => {
  query = event.target.value;
  updateProjects();
});

function updateProjects() {
  // First apply the search filter
  let searchResults = projects.filter((project) => {
    let values = Object.values(project).join('\n').toLowerCase();
    return values.includes(query);
  });

  // Then apply the selected year filter
  let filteredProjects = searchResults;

  if (selectedYear !== null) {
    filteredProjects = searchResults.filter(
      (project) => project.year === selectedYear
    );
  }

  // Update project list and pie chart
  renderProjects(filteredProjects, projectsContainer, 'h2');
  renderPieChart(searchResults);
}

function renderPieChart(projectsGiven) {
  // Group projects by year
  let newRolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year
  );
  // Convert grouped data
  let newData = newRolledData.map(([year, count]) => ({
    value: count,
    label: year
  }));
  // Generate pie slices
  let newSliceGenerator = d3.pie()
    .value((d) => d.value);
  let newArcData = newSliceGenerator(newData);
  // Generate arc paths
  let newArcGenerator = d3.arc()
    .innerRadius(0)
    .outerRadius(50);

  let newArcs = newArcData.map((d) => newArcGenerator(d));
  let svg = d3.select('#projects-pie-plot');
  let legend = d3.select('.legend');
  function selectSlice(i) {
    let clickedYear = newData[i].label;
    selectedYear = selectedYear === clickedYear
        ? null
        : clickedYear;
    updateProjects();
  }
  svg.selectAll('path').remove();
  legend.selectAll('li').remove();
  let colors = d3.scaleOrdinal(d3.schemeTableau10);
  newArcs.forEach((arc, idx) => {
    svg.append('path')
    .attr('d', arc)
    .attr('fill', colors(idx))
    .attr('class', newData[idx].label === selectedYear ? 'selected' : '')
    .on('click', () => selectSlice(idx));
  });
  newData.forEach((d, idx) => {
    legend.append('li')
    .attr('style', `--color:${colors(idx)}`)
    .attr('class', newData[idx].label === selectedYear
      ? 'legend-item selected'
      : 'legend-item')
    .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
    .on('click', () => selectSlice(idx));
  });
}
updateProjects();