/* ============================================================
   Repositories & CERN GitLab Activity Calendar Logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
    const reposGrid = document.getElementById('repos-grid');
    const activityGrid = document.getElementById('activity-grid');

    if (!reposGrid || !activityGrid) return;

    try {
        // --- 1. Load Projects List ---
        const projectsResponse = await fetch('data/gitlab_projects.json');
        if (projectsResponse.ok) {
            const projects = await projectsResponse.json();
            renderProjects(projects);
        } else {
            reposGrid.innerHTML = '<div class="error-msg">Failed to load projects list.</div>';
        }

        // --- 2. Load GitLab Activity & Build Grid ---
        const activityResponse = await fetch('data/gitlab_activity.json');
        if (activityResponse.ok) {
            const activity = await activityResponse.json();
            buildContributionGrid(activity);
        } else {
            activityGrid.innerHTML = '<div class="error-msg">Failed to load activity details.</div>';
        }

    } catch (err) {
        console.error('Error loading repositories data:', err);
        reposGrid.innerHTML = `<div class="error-msg">Error: ${err.message}</div>`;
    }
});

// ---- Render GitLab projects ----
function renderProjects(projects) {
    const reposGrid = document.getElementById('repos-grid');
    if (!reposGrid) return;

    if (projects.length === 0) {
        reposGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No public projects found.</p>';
        return;
    }

    reposGrid.innerHTML = projects.map((project, idx) => {
        // Humanize the date
        const dateStr = project.last_activity_at 
            ? new Date(project.last_activity_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
            : 'Recently';

        const desc = project.description || 'No description provided.';

        return `
        <div class="repo-card reveal-up" style="animation-delay: ${idx * 0.05}s">
            <div class="repo-header">
                <h3><a href="${project.web_url}" target="_blank" rel="noopener">${project.name}</a></h3>
                <span class="gitlab-badge">GitLab</span>
            </div>
            <p class="repo-description">${desc}</p>
            <div class="repo-meta">
                <span class="repo-meta-item">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    ${project.star_count}
                </span>
                <span class="repo-meta-item">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></svg>
                    ${project.forks_count}
                </span>
                <span style="margin-left: auto;">Updated: ${dateStr}</span>
            </div>
        </div>`;
    }).join('');
}

// ---- Build dynamic contribution calendar grid ----
function buildContributionGrid(events) {
    const activityGrid = document.getElementById('activity-grid');
    if (!activityGrid) return;

    // 1. Group events by date (YYYY-MM-DD)
    const counts = {};
    events.forEach(ev => {
        if (ev.created_at) {
            const dateStr = ev.created_at.substring(0, 10);
            counts[dateStr] = (counts[dateStr] || 0) + 1;
        }
    });

    // 2. Determine date range (past 371 days, aligned to start on Sunday)
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0: Sunday, 6: Saturday
    const daysToShow = 371; // 53 weeks * 7 days
    
    // Calculate the start date (Sunday of 53 weeks ago)
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (daysToShow - 1) + dayOfWeek - 6); 
    // This adjusts so that the last column aligns with today's weekday

    // Normalize start date to midnight
    startDate.setHours(0, 0, 0, 0);

    const cellsHtml = [];
    
    // 3. Generate all 371 cells
    for (let i = 0; i < daysToShow; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        
        const dateStr = currentDate.toISOString().substring(0, 10);
        const count = counts[dateStr] || 0;
        
        // Determine level (0 to 4)
        let level = 0;
        if (count > 0 && count <= 2) level = 1;
        else if (count >= 3 && count <= 5) level = 2;
        else if (count >= 6 && count <= 9) level = 3;
        else if (count >= 10) level = 4;

        const dateFormatted = currentDate.toLocaleDateString(undefined, { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });

        const tooltip = `${count} contribution${count === 1 ? '' : 's'} on ${dateFormatted}`;
        
        cellsHtml.push({
            html: `<div class="activity-cell level-${level}" data-date="${dateStr}" data-count="${count}" title="${tooltip}"></div>`,
            dayOfWeek: currentDate.getDay()
        });
    }

    // Grid ordering: D3/GitHub lists cells column by column (Sunday to Saturday, then next week)
    // D3 handles this by inserting nodes in order. With CSS Grid 'grid-auto-flow: column' it automatically works if elements are in chronological order!
    activityGrid.innerHTML = cellsHtml.map(c => c.html).join('');
}
