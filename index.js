import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';

const projects = await fetchJSON('./lib/projects.json');

const latestProjects = projects.slice(0, 3);

const projectsContainer = document.querySelector('.projects');

renderProjects(latestProjects, projectsContainer, 'h2');

const githubData = await fetchGitHubData('SeanL024');

const profileStats = document.querySelector('#profile-stats');

if (githubData && profileStats) {
  profileStats.innerHTML = `
    <div class="stat">
      <strong>${githubData.public_repos}</strong>
      <span>Repositories</span>
    </div>
    <div class="stat">
      <strong>${githubData.public_gists}</strong>
      <span>Gists</span>
    </div>
    <div class="stat">
      <strong>${githubData.followers}</strong>
      <span>Followers</span>
    </div>
    <div class="stat">
      <strong>${githubData.following}</strong>
      <span>Following</span>
    </div>
  `;
}