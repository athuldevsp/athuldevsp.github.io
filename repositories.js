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
    const contributionCalendar = window.gitlabContributionCalendar || null;

    const fetchedEl = document.getElementById('gitlab-last-fetch');
    if (fetchedEl && window.gitlabFetchedAt) {
        const fetchedAt = new Date(window.gitlabFetchedAt);
        fetchedEl.innerHTML = `GitLab data last fetched: <time datetime="${window.gitlabFetchedAt}">${new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short'
        }).format(fetchedAt)}</time>`;
    }

    // Render projects list
    renderProjects(projects);

    // Render activity calendar
    buildContributionGrid(activity, contributionCalendar);

    // Recalculate from the calendar's actual width, including layout changes
    // that do not trigger a window resize.
    const gridContainer = activityGrid.parentElement;
    let resizeFrame = 0;
    const scheduleGridBuild = () => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => buildContributionGrid(activity, contributionCalendar));
    };
    if ('ResizeObserver' in window && gridContainer) {
        const gridObserver = new ResizeObserver(scheduleGridBuild);
        gridObserver.observe(gridContainer);
    } else {
        window.addEventListener('resize', scheduleGridBuild, { passive: true });
    }
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
        <div class="repo-card" style="animation-delay: ${idx * 0.05}s">
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
function buildContributionGrid(events, contributionCalendar = null) {
    const activityGrid = document.getElementById('activity-grid');
    const activityMonths = document.getElementById('activity-months');
    if (!activityGrid) return;

    if ((!events || events.length === 0) && !contributionCalendar) {
        activityGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No activity data found.</p>';
        return;
    }

    // 1. Use GitLab's exact daily calendar totals, with event records only as
    // a backwards-compatible fallback for older generated datasets.
    const counts = contributionCalendar
        ? { ...contributionCalendar }
        : events.reduce((dailyCounts, ev) => {
            if (ev.created_at) {
                const dateStr = ev.created_at.substring(0, 10);
                dailyCounts[dateStr] = (dailyCounts[dateStr] || 0) + 1;
            }
            return dailyCounts;
        }, {});

    const end = new Date();
    const endDay = end.getUTCDay();
    end.setUTCDate(end.getUTCDate() + (6 - endDay)); // Saturday of current week
    end.setUTCHours(23, 59, 59, 999);

    // GitLab's calendar endpoint returns one year. Keep all 53 calendar columns
    // and resize their cells to consume the exact available width.
    const containerWidth = Math.max(1, activityGrid.parentElement?.clientWidth || 1100);
    const gap = containerWidth < 480 ? 1 : containerWidth < 760 ? 2 : 3;
    const numWeeks = 53;
    const cellSize = (containerWidth - gap * (numWeeks - 1)) / numWeeks;
    const daysToShow = numWeeks * 7;

    // Show the most recent weeks and align the range Sunday through Saturday.
    const start = new Date(end);
    start.setUTCDate(end.getUTCDate() - (daysToShow - 1));
    start.setUTCHours(0, 0, 0, 0);

    // Apply fluid tracks to both calendar rows and month labels.
    activityGrid.style.gridTemplateColumns = `repeat(${numWeeks}, minmax(0, 1fr))`;
    activityGrid.style.gridTemplateRows = `repeat(7, ${cellSize}px)`;
    activityGrid.style.columnGap = `${gap}px`;
    activityGrid.style.rowGap = `${gap}px`;
    if (activityMonths) {
        activityMonths.style.gridTemplateColumns = `repeat(${numWeeks}, minmax(0, 1fr))`;
        activityMonths.style.columnGap = `${gap}px`;
    }

    // 2. Generate month/year timeline labels
    const monthLabels = [];
    let lastMonthStr = '';
    for (let week = 0; week < numWeeks; week++) {
        const sundayDate = new Date(start);
        sundayDate.setUTCDate(start.getUTCDate() + week * 7);
        
        const monthName = sundayDate.toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short' });
        const yearName = sundayDate.getUTCFullYear().toString().substring(2);
        const monthStr = `${monthName} '${yearName}`;
        
        if (monthStr !== lastMonthStr) {
            monthLabels.push({
                text: monthStr,
                column: week + 1
            });
            lastMonthStr = monthStr;
        }
    }

    // Filter labels according to the actual rendered track width.
    if (activityMonths) {
        const filteredLabels = [];
        const minimumLabelGap = Math.max(6, Math.ceil(62 / (cellSize + gap)));
        let lastCol = -minimumLabelGap;
        monthLabels.forEach(label => {
            if (label.column - lastCol >= minimumLabelGap) {
                filteredLabels.push(label);
                lastCol = label.column;
            }
        });
        
        activityMonths.innerHTML = filteredLabels.map(l => {
            return `
                <span class="activity-month-label" style="grid-row: 1; grid-column: ${l.column} / span ${minimumLabelGap};">${l.text}</span>
                <span class="activity-tick" style="grid-row: 2; grid-column: ${l.column};"></span>
            `;
        }).join('');
    }

    // 3. Generate all contribution cells
    const cellsHtml = [];
    for (let i = 0; i < daysToShow; i++) {
        const currentDate = new Date(start);
        currentDate.setUTCDate(start.getUTCDate() + i);
        
        const dateStr = currentDate.toISOString().substring(0, 10);
        const count = counts[dateStr] || 0;
        
        let level = 0;
        if (count >= 30) level = 4;
        else if (count >= 20) level = 3;
        else if (count >= 10) level = 2;
        else if (count > 0) level = 1;

        const dateFormatted = currentDate.toLocaleDateString(undefined, { 
            timeZone: 'UTC',
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
