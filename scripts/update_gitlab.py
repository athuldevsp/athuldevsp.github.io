import urllib.request
import json
import os

USER_ID = 28469
BASE_URL = "https://gitlab.cern.ch/api/v4"

def fetch_data(endpoint):
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode('utf-8'))

def main():
    print("Fetching GitLab projects...")
    try:
        projects = fetch_data(f"/users/{USER_ID}/projects")
        # Extract relevant fields
        formatted_projects = []
        for p in projects:
            formatted_projects.append({
                "id": p.get("id"),
                "name": p.get("name"),
                "description": p.get("description"),
                "web_url": p.get("web_url"),
                "star_count": p.get("star_count", 0),
                "forks_count": p.get("forks_count", 0),
                "last_activity_at": p.get("last_activity_at")
            })
        
        # Save projects
        os.makedirs("data", exist_ok=True)
        with open("data/gitlab_projects.json", "w", encoding="utf-8") as f:
            json.dump(formatted_projects, f, indent=2, ensure_ascii=False)
        print(f"Saved {len(formatted_projects)} projects.")
    except Exception as e:
        print("Error fetching projects:", e)

    print("Fetching GitLab events (activity)...")
    try:
        events = []
        # Fetch up to 5 pages (500 events) for a richer calendar
        for page in range(1, 6):
            print(f"Fetching page {page} of events...")
            page_events = fetch_data(f"/users/{USER_ID}/events?per_page=100&page={page}")
            if not page_events:
                break
            events.extend(page_events)
            
        # Format events: extract date and action
        formatted_events = []
        for ev in events:
            formatted_events.append({
                "created_at": ev.get("created_at"),
                "action_name": ev.get("action_name"),
                "target_type": ev.get("target_type")
            })
            
        with open("data/gitlab_activity.json", "w", encoding="utf-8") as f:
            json.dump(formatted_events, f, indent=2, ensure_ascii=False)
        print(f"Saved {len(formatted_events)} events.")
    except Exception as e:
        print("Error fetching events:", e)

if __name__ == "__main__":
    main()
