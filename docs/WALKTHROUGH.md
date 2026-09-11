# Walkthrough script (3–4 minutes)

Record this against the deployed app.

1. **0:00 Register / login** — show session cookie auth, then the empty kit list.
2. **0:20 New kit** — paste a real JD, a real company URL, days = 5. Submit. Show the live checklist (not a spinner).
3. **1:20 Finished kit** — company brief with sources, hiring process found or honestly missing, requirements with must vs nice.
4. **1:50 Coverage strip** — must-haves mapped to questions.
5. **2:00 Builder** — edit a technical question, pin it, regenerate Technical, show the edit survived. Drag to reorder. Move a question’s category. Add and delete.
6. **2:50 Schedule** — exactly 5 days, integer minutes, harder material first.
7. **3:10 Practice** — reveal, rate 1–5, show weak spots. Keyboard: Enter to reveal, arrows to move, Esc to leave.
8. **3:40 CLI** — `npm run evaluate -- --input samples/cases.example.json --output kits.json` and open the JSON (`status`, `coverage`, `schedule.days_available`).

Mention out loud: coverage and schedule are computed in code; crawled pages are untrusted data; localhost URLs work in evaluation mode.
