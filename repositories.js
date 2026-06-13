/* ============================================================
   Repositories & CERN GitLab Activity Calendar Logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const reposGrid = document.getElementById('repos-grid');
    const activityGrid = document.getElementById('activity-grid');

    if (!reposGrid || !activityGrid) return;

    // Load from window variables (pre-loaded via script tags to bypass CORS on file:// protocol)
    const projects = window.gitlabProjects || [];
    const activity = window.gitlabActivity || [];

    // Render projects list
    renderProjects(projects);

    // Render activity calendar
    buildContributionGrid(activity);
    
    // Recalculate grid on resize to fit perfectly without scrollbars
    window.addEventListener('resize', () => {
        buildContributionGrid(activity);
    });
});

// ---- Render GitLab projects ----
function renderProjects(projects) {
    const reposGrid = document.getElementById('repos-grid');
    if (!reposGrid) return;

    if (!projects || projects.length === 0) {
        reposGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No public repositories found.</p>';
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
    const activityMonths = document.getElementById('activity-months');
    if (!activityGrid) return;

    if (!events || events.length === 0) {
        activityGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No activity data found.</p>';
        return;
    }

    // 1. Group events by date (YYYY-MM-DD)
    const counts = {};
    let minDate = new Date(); // Fallback to today
    let hasEvents = false;

    events.forEach(ev => {
        if (ev.created_at) {
            const dateStr = ev.created_at.substring(0, 10);
            counts[dateStr] = (counts[dateStr] || 0) + 1;
            
            const d = new Date(ev.created_at);
            if (d < minDate) {
                minDate = d;
                hasEvents = true;
            }
        }
    });

    // Determine absolute oldest date
    const absoluteStart = new Date(hasEvents ? minDate : new Date());
    const startDay = absoluteStart.getDay();
    absoluteStart.setDate(absoluteStart.getDate() - startDay); // Sunday before minDate
    absoluteStart.setHours(0, 0, 0, 0);

    const end = new Date();
    const endDay = end.getDay();
    end.setDate(end.getDate() + (6 - endDay)); // Saturday of current week
    end.setHours(23, 59, 59, 999);

    // Calculate maximum available weeks
    const totalDiffTime = Math.abs(end - absoluteStart);
    const totalDiffDays = Math.ceil(totalDiffTime / (1000 * 60 * 60 * 24));
    const totalAvailableWeeks = Math.ceil(totalDiffDays / 7);

    // Calculate how many weeks can fit in the container width
    const containerWidth = activityGrid.parentElement.offsetWidth || 1100;
    const colWidth = 13; // 10px cell + 3px gap
    const fitWeeks = Math.floor((containerWidth - 10) / colWidth); // Subtract small offset for padding
    
    // Choose weeks to show (fit within width, not exceeding available data)
    const numWeeks = Math.max(12, Math.min(fitWeeks, totalAvailableWeeks)); 
    const daysToShow = numWeeks * 7;

    // Adjust start date to only show the last numWeeks
    const start = new Date(end);
    start.setDate(end.getDate() - (daysToShow - 1));
    const startAdjustDay = start.getDay();
    start.setDate(start.getDate() - startAdjustDay); // Align to Sunday
    start.setHours(0, 0, 0, 0);

    // Apply grid template column counts dynamically
    activityGrid.style.gridTemplateColumns = `repeat(${numWeeks}, 10px)`;
    if (activityMonths) {
        activityMonths.style.gridTemplateColumns = `repeat(${numWeeks}, 10px)`;
    }

    // 2. Generate month/year timeline labels
    const monthLabels = [];
    let lastMonthStr = '';
    for (let week = 0; week < numWeeks; week++) {
        const sundayDate = new Date(start);
        sundayDate.setDate(start.getDate() + week * 7);
        
        const monthName = sundayDate.toLocaleDateString(undefined, { month: 'short' });
        const yearName = sundayDate.getFullYear().toString().substring(2);
        const monthStr = `${monthName} '${yearName}`;
        
        if (monthStr !== lastMonthStr) {
            monthLabels.push({
                text: monthStr,
                column: week + 1
            });
            lastMonthStr = monthStr;
        }
    }

    // Filter labels to prevent overlaps (minimum gap of 6 weeks)
    if (activityMonths) {
        const filteredLabels = [];
        let lastCol = -10;
        monthLabels.forEach(label => {
            if (label.column - lastCol >= 6) {
                filteredLabels.push(label);
                lastCol = label.column;
            }
        });
        
        activityMonths.innerHTML = filteredLabels.map(l => {
            return `
                <span class="activity-month-label" style="grid-row: 1; grid-column: ${l.column} / span 6;">${l.text}</span>
                <span class="activity-tick" style="grid-row: 2; grid-column: ${l.column};"></span>
            `;
        }).join('');
    }

    // 3. Generate all contribution cells
    const cellsHtml = [];
    for (let i = 0; i < daysToShow; i++) {
        const currentDate = new Date(start);
        currentDate.setDate(start.getDate() + i);
        
        const dateStr = currentDate.toISOString().substring(0, 10);
        const count = counts[dateStr] || 0;
        
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
            html: `<div class="activity-cell level-${level}" data-date="${dateStr}" data-count="${count}" title="${tooltip}"></div>`
        });
    }

    activityGrid.innerHTML = cellsHtml.map(c => c.html).join('');
}
