# BulanTanom — Functional Test Cases

**Scope:** Crop Recommendation, Add Plant, Plant Assessment (Farmer side)
**Prepared:** 2026-09-26

**Test accounts needed**

| Account | Purpose |
|---|---|
| Farmer A (approved) | Main tester |
| Farmer B (approved) | Checks that one farmer cannot see another farmer's data |
| Farmer C (pending, not yet approved) | Checks that unapproved accounts are blocked |
| LGU Officer | Checks that officers can see records but cannot submit them |

**Status values:** Pass / Fail / Blocked. Fill in *Actual Result* and *Status* while you test.

---

## 1. Crop Recommendation (Soil Detector → AI Crop Advice)

Page: **Farmer → Crop Recommendation** (`/farmer/soil-recommendation`)

**Valid reading set used below ("Set V"):**
Temperature 28.5 °C · Moisture 45 % · Conductivity 850 µS/cm · pH 6.5 · Nitrogen 120 mg/kg · Phosphorus 45 mg/kg · Potassium 180 mg/kg · Fertility 900 mg/kg

| ID | Test Scenario | Pre-condition | Test Steps | Test Data | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|---|
| CR-01 | Get a crop recommendation with all valid readings | Logged in as Farmer A, AI is online | 1. Open Crop Recommendation<br>2. Enter all 8 readings<br>3. Click Submit | Set V, Notes: "Dries out quickly after noon" | A loading/"analyzing" screen shows, then the result shows six sections: Suitable Fruits, Suitable Vegetables, Other Suitable Crops, Fertilizer Recommendations, Soil Improvement & Watering, Important Warnings. Each crop shows its emoji, name and a reason that refers to the readings. | | |
| CR-02 | Notes are optional | Farmer A | Submit Set V with Notes left blank | Set V, Notes: (empty) | Recommendation is generated normally. | | |
| CR-03 | A reading is left blank | Farmer A | Clear one reading (e.g. pH) and submit | Set V without pH | Not submitted. pH field shows "This reading is required." Other fields keep their values. | | |
| CR-04 | All readings left blank | Farmer A | Click Submit on an empty form | (none) | Not submitted. Every one of the 8 fields shows "This reading is required." | | |
| CR-05 | pH above the limit | Farmer A | Enter pH 11, rest valid, submit | pH = 11 | Rejected. pH field: "Must be between 3 and 10 pH - outside what the soil detector can report." | | |
| CR-06 | pH below the limit | Farmer A | Enter pH 2.5, submit | pH = 2.5 | Rejected with the pH range message. | | |
| CR-07 | Temperature out of range | Farmer A | Enter temperature 90, submit | Temp = 90 | Rejected: "Must be between -40 and 80 °C …" | | |
| CR-08 | Moisture out of range | Farmer A | Enter moisture 120, submit | Moisture = 120 | Rejected: "Must be between 0 and 100 % …" | | |
| CR-09 | Conductivity out of range | Farmer A | Enter conductivity 25000, submit | Conductivity = 25000 | Rejected: "Must be between 0 and 20000 µS/cm …" | | |
| CR-10 | Nitrogen / Phosphorus / Potassium at 0 | Farmer A | Enter N = 0, submit. Repeat for P and K | N/P/K = 0 | Rejected: "Must be between 1 and 1999 mg/kg …" | | |
| CR-11 | Nitrogen / Phosphorus / Potassium too high | Farmer A | Enter N = 2000, submit. Repeat for P and K | N/P/K = 2000 | Rejected with the 1–1999 mg/kg message. | | |
| CR-12 | Fertility out of range | Farmer A | Enter fertility 3500, submit | Fertility = 3500 | Rejected: "Must be between 0 and 3000 mg/kg …" | | |
| CR-13 | Boundary values are accepted | Farmer A | Submit readings exactly on the limits | Temp -40 / 80, Moisture 0 / 100, pH 3 / 10, N/P/K 1 / 1999, Conductivity 0 / 20000, Fertility 0 / 3000 | Accepted (no range error) for every boundary value. | | |
| CR-14 | Notes too long | Farmer A | Paste more than 2000 characters into Notes, submit | 2001 characters | Rejected: "Please keep additional soil information under 2000 characters." | | |
| CR-15 | Recommended crops come only from the catalog | CR-01 done | Look at every crop in the three crop sections | Result of CR-01 | Every crop is one that exists in the Add Plant crop list and has an emoji. No crop appears in more than one section. | | |
| CR-16 | Different soil gives different advice | CR-01 done | Submit a clearly different reading set | Temp 33, Moisture 12, Conductivity 150, pH 4.8, N 15, P 8, K 30, Fertility 80 | Recommended crops and warnings differ from CR-01 and refer to the low pH / dry soil / low nutrients. | | |
| CR-17 | AI is unavailable | Farmer A; turn off internet on the server or remove `GEMINI_API_KEY` | Submit Set V | Set V | Readings are still **saved**. Page shows "AI recommendation is temporarily unavailable." with a **Try Again** button. The entry appears in history as not analyzed. | | |
| CR-18 | Try Again after a failed analysis | CR-17 done, AI back online | Click **Try Again** | Saved record from CR-17 | The same readings are analyzed (not re-typed) and the six-section result appears. | | |
| CR-19 | Try Again on an already-analyzed record | CR-01 done | Call Try Again / reanalyze on the CR-01 record | Record from CR-01 | Same result is returned unchanged; no new AI call is made. | | |
| CR-20 | Save without analyzing ("Back to Dashboard") | Farmer A | Enter Set V, click Back to Dashboard | Set V | Readings are saved with no AI result, marked "not analyzed" in history. A notification is created. | | |
| CR-21 | Double-click Back does not duplicate | Farmer A | Enter Set V, double-click Back quickly | Set V | Only **one** record is saved. | | |
| CR-22 | Re-open a past result | At least 2 saved records | Pick an older record from the history dropdown | — | The saved result shows instantly with its original readings; nothing is re-analyzed. | | |
| CR-23 | Latest result loads on page open | CR-01 done | Refresh the page / log out and back in | — | The most recent recommendation is shown automatically. | | |
| CR-24 | First-time farmer has no history | New approved farmer with no records | Open Crop Recommendation | — | Empty form is shown; no error. | | |
| CR-25 | Warning notification for concerning readings | Farmer A | Submit a concerning set (e.g. pH 4.0) | pH 4.0, rest of Set V | Result is shown and the notification bell shows a soil warning. | | |
| CR-26 | Unapproved farmer is blocked | Logged in as Farmer C (pending) | Try to open/submit Crop Recommendation | Set V | Access is denied (403). Nothing is saved. | | |
| CR-27 | Farmer cannot open another farmer's record | Farmer B has a saved record, ID known | As Farmer A, open `/api/farmer/soil-recommendations/{B's id}/` | B's record ID | 404 Not Found. B's readings are not shown. | | |
| CR-28 | LGU Officer can view but not submit | Logged in as LGU Officer | 1. Open LGU → Crop Recommendation Records<br>2. Try POST to `/api/farmer/soil-recommendations/` | Set V | 1. Farmer A's record is listed with farmer name, readings and recommended crops with reasons.<br>2. POST is denied (403). | | |
| CR-29 | AI fields cannot be injected | Farmer A, API client (Postman) | POST Set V plus `"suitable_fruits": [{"name":"Fake"}]`, `"ai_generated": true` | Set V + extra fields | Extra fields are ignored. The result comes from the AI only (or is marked not analyzed). | | |

---

## 2. Add Plant

Page: **Farmer → My Plants → Add Plant** (`/farmer/plants/new`)

Reference crop data (from the catalog):
- **Tomato:** grows 85 days, harvest window 30 days, preferred planting Feb–May
- **Corn → Sweet Corn variety:** grows 75 days, harvest window 14 days

| ID | Test Scenario | Pre-condition | Test Steps | Test Data | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|---|
| AP-01 | Add a plant successfully | Logged in as Farmer A | 1. Click Add Plant<br>2. Choose Tomato<br>3. Pick a planting date<br>4. Click Continue<br>5. Review and click Add Plant / Save | Crop: Tomato, Date: today | Progress steps show ("Preparing crop information", "Calculating harvest window", "Generating growing guidance"). Review screen shows the harvest window and growing guidance. After saving, you are taken to the new plant's page. "Plant added" notification appears. | | |
| AP-02 | Harvest window is calculated correctly | Farmer A | Add Tomato with a fixed date | Tomato, 2026-10-01 | Expected harvest: **2026-12-25 to 2027-01-24** (85 days + 30-day window). Same dates show on the review screen and on the saved plant. | | |
| AP-03 | Variety changes the harvest window | Farmer A | Choose Corn, then variety Sweet Corn, date 2026-10-01 | Corn / Sweet Corn, 2026-10-01 | Expected harvest: **2026-12-15 to 2026-12-29** (75 + 14 days). Plant name shows "Sweet Corn". | | |
| AP-04 | No crop selected | Farmer A | Leave crop empty, pick a date, click Continue | Date only | Not submitted. Error: "Please select a valid crop." | | |
| AP-05 | No planting date | Farmer A | Pick a crop, leave date empty, click Continue | Crop only | Not submitted. Error: "Please select a valid planting date." | | |
| AP-06 | Planting date in the past (form) | Farmer A | Pick a crop and yesterday's date, click Continue | Date: yesterday | Not submitted. Error: "Please pick today or a later planting date." | | |
| AP-07 | Future planting date (planned plant) | Farmer A | Add Tomato with a date 10 days from today | Date: today + 10 | Plant is saved and marked **Planned**. Its assessment is locked until the planting date. | | |
| AP-08 | Out-of-season planting note | Farmer A | Choose Tomato with an October date | Tomato, 2026-10-01 | A season note shows that October is outside the recommended planting window (Feb–May), with the reason/risk. Saving is still allowed. | | |
| AP-09 | In-season planting | Farmer A | Choose Tomato with a March date | Tomato, 2027-03-01 | No out-of-season warning; note shows it is within the preferred window. | | |
| AP-10 | Duplicate plant warning | Farmer A already has Tomato planted 2026-10-01 | Add Tomato again with 2026-10-01 | Tomato, 2026-10-01 | Warning: "You already recorded Tomato planted on this date. Add another only if this is a separate planting." Farmer can still save. | | |
| AP-11 | Search crop by local name | Farmer A | Type a local name in the crop search | "kamatis" | Tomato (Native / Kamatis) appears in the results. | | |
| AP-12 | In-season crops are recommended first | Farmer A | Open the crop picker | — | Crops suited to the current month are listed first / marked recommended. | | |
| AP-13 | Crop list fails to load | Stop the backend, open Add Plant | — | — | Error message with a **Try Again** button. Clicking it after the backend is back loads the list. | | |
| AP-14 | Crop guidance AI unavailable | Remove `GEMINI_API_KEY` or cut internet on server | Add Tomato, click Continue | Tomato, today | Harvest window still shows (it is calculated, not AI). Guidance shows as temporarily unavailable. Farmer can still save the plant. | | |
| AP-15 | Variety from a different crop (API) | Farmer A, API client | POST `/api/farmer/plants/` with `crop_id: "tomato"`, `variant_id: "corn-sweet"` | — | 400: "That variety does not belong to the selected crop." Nothing saved. | | |
| AP-16 | Invalid / very old date (API) | Farmer A, API client | POST with `planting_date: "1900-01-01"`, then `"2026-02-31"` | — | 1900 → "Please enter a more recent planting date." 2026-02-31 → date format error. Nothing saved. | | |
| AP-17 | Invalid crop (API) | Farmer A, API client | POST with `crop_id: "not-a-crop"` | — | 400 error on `crop_id`. Nothing saved. | | |
| AP-18 | Edit planting date recalculates harvest | Plant from AP-02 exists | Change its planting date to 2026-10-11 | Tomato, 2026-10-11 | Harvest window moves 10 days later: 2027-01-04 to 2027-02-03. | | |
| AP-19 | Plant appears in My Plants and Dashboard | AP-01 done | Open My Plants and Dashboard | — | New plant is listed with crop emoji, name, planting date, age, status "Growing" and expected harvest. | | |
| AP-20 | Farmer cannot see another farmer's plant | Farmer B has a plant, ID known | As Farmer A, open `/farmer/plants/{B's id}` | B's plant ID | "Not found" (404). Farmer B's plant does not appear in Farmer A's list. | | |
| AP-21 | Cannot add a plant for another farmer | Farmer A, API client | POST a valid plant with `"farmer": <Farmer B's id>` | — | Plant is created under **Farmer A**; the `farmer` field is ignored. | | |
| AP-22 | LGU Officer cannot add plants | Logged in as LGU Officer | POST to `/api/farmer/plants/` | Valid plant | Denied (403). | | |

---

## 3. Plant Assessment (Weekly Check + AI Risk Reading)

Page: **Farmer → My Plants → (plant) → Assessment** (`/farmer/plants/{id}/assessment`)

**Rules being tested:** first assessment opens 7 days after planting · one assessment per plant every 7 days · a photo of the actual crop is required · photo must be JPEG/PNG under 5 MB.

**Required fields:** Growth condition, Health condition, Leaf condition, Watering frequency, Photo.
**Optional fields:** Plant height, Flowering, Fruiting, Soil moisture, Pest, Disease, Environment, Notes.

| ID | Test Scenario | Pre-condition | Test Steps | Test Data | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|---|
| AS-01 | Plant too young to assess | Plant planted 3 days ago | Open its Assessment page | — | Assessment is locked. Message says the first assessment opens on (planting date + 7 days). API POST returns 409: "This plant was only just planted. Its first assessment opens on …" | | |
| AS-02 | Planned plant cannot be assessed | Plant with a future planting date | Open its Assessment page | — | Locked. Message says it is planned and can be assessed from the planting date. API POST returns 409. | | |
| AS-03 | Eligible plant shows the form | Plant planted 7+ days ago, never assessed | Open its Assessment page | — | Form is enabled. | | |
| AS-04 | Submit a complete assessment | AS-03 plant | 1. Fill required + optional fields<br>2. Upload a clear photo of the plant<br>3. Submit | Height 35 cm, Growth: As expected, Health: Healthy, Leaf: Healthy green leaves, Watering: Every other day, Soil: Moist, Photo: tomato plant (JPG, 2 MB) | Photo is checked first ("verifying"), then the risk result shows: risk level (Low / Medium / High / Too early to tell), summary, expected vs observed, risk factors, recommended actions, monitoring advice and next assessment date. Saved in the plant's history. | | |
| AS-05 | Submit button disabled when required fields are missing | AS-03 plant | Leave each required field empty in turn (Growth, Health, Leaf, Watering, Photo) | — | Submit stays disabled until all required fields and a photo are provided. | | |
| AS-06 | No photo (API) | AS-03 plant, API client | POST the assessment without `evidence_image` | Required fields only | 400: "A plant photo is required so the evidence can be verified." Nothing saved. | | |
| AS-07 | Photo shows the wrong crop | AS-03 tomato plant | Upload a photo of a banana tree / a person / a blank wall, submit | Wrong-subject photo | Photo is **rejected** with the reason. Assessment is **not** saved. The form keeps everything else that was typed so the farmer can replace the photo. | | |
| AS-08 | Photo too large | AS-03 plant | Upload a 6 MB JPG | 6 MB JPG | Rejected: "Image is too large. Please upload a photo under 5MB." | | |
| AS-09 | Wrong file type | AS-03 plant | Upload a GIF, a PDF, and an SVG renamed to `.jpg` | Non-image files | Rejected: "Only JPEG and PNG photos are accepted." or "That file could not be read as a valid image." | | |
| AS-10 | PNG photo is accepted | AS-03 plant | Submit with a valid PNG of the plant | PNG, 1 MB | Accepted like a JPG. | | |
| AS-11 | Unrealistic plant height | AS-03 plant | Enter height -5, then 6000, submit | -5 / 6000 cm | Rejected: "Please enter a realistic plant height in cm." | | |
| AS-12 | Second assessment in the same week | AS-04 done today | Try to assess the same plant again | — | Locked. Message: "You have already completed this week's assessment for this plant. The next one is available on (today + 7)." API returns 409. | | |
| AS-13 | Assessment opens again after 7 days | AS-04 done 7 days ago | Open the Assessment page and submit | Valid data + photo | Accepted. Plant history now shows both assessments, newest first; the trend chart shows both readings. | | |
| AS-14 | Plant age is calculated by the system | AS-03 plant, API client | POST a valid assessment with `plant_age_days: 999` | — | Saved age equals today minus planting date; the 999 is ignored. | | |
| AS-15 | Early-stage healthy plant | Plant 8–14 days old, no problems reported | Submit with Healthy / As expected, clear seedling photo | — | Risk result may be **"Too early to tell"** (Inconclusive) with a reason, instead of a guessed Low. | | |
| AS-16 | Early-stage plant with a real problem | Plant 8–14 days old | Submit with Leaf: Wilting, Pest: "Aphids under the leaves", matching photo | — | A real risk level (Medium or High) is given, **not** "Too early to tell". | | |
| AS-17 | Unhealthy plant | Plant 30+ days old | Submit with Growth: Stunted, Health: Unhealthy, Leaf: Spots or lesions, Disease: "Brown spots spreading", matching photo | — | Risk level is Medium or High, with risk factors, possible causes and recommended actions filled in. | | |
| AS-18 | Photo doesn't match plant age | Plant 8 days old | Submit with a photo of a fully grown plant with ripe fruit (same crop) | — | Result is "Too early to tell" with a planting-date mismatch notice asking the farmer to check the date or photo — **not** High risk. | | |
| AS-19 | Photo check service is down | Remove `GEMINI_API_KEY` / cut server internet | Submit a valid assessment | Valid data + photo | Error: "Plant evidence could not be verified right now. Please try again in a moment." (503). Nothing saved. | | |
| AS-20 | Risk AI fails after photo is accepted | Photo verified but risk AI fails (e.g. quota reached) | Submit a valid assessment | Valid data + photo | Assessment **is saved**, risk shows as failed with no level (never a fake Low/Medium/High). A retry/re-analyze option is shown. | | |
| AS-21 | Re-analyze a failed risk reading | AS-20 done, AI back online | Click re-analyze / Try Again | — | Risk reading is generated from the saved answers and photo. The answers cannot be edited in this step. | | |
| AS-22 | Re-analyze a completed reading | AS-04 done | Call re-analyze on it | — | Returned unchanged; no new AI call. | | |
| AS-23 | View a past assessment | AS-04 done | Open Assessments → pick the record | — | Shows all answers, the photo, the verified-evidence badge and the full risk result. | | |
| AS-24 | Farmer cannot view another farmer's assessment or photo | Farmer B has an assessment, ID known | As Farmer A open `/api/farmer/assessments/{id}/` and `/api/farmer/assessments/{id}/evidence/` | B's assessment ID | 404 on both. | | |
| AS-25 | Farmer cannot assess another farmer's plant | Farmer B's plant ID known | As Farmer A POST to `/api/farmer/plants/{B's id}/assessments/` | Valid data | 404. Nothing saved. | | |
| AS-26 | Notifications after assessment | AS-04 done | Open the notification bell | — | Notifications for "assessment submitted" and "risk evaluated". If the level changed from last week, a "risk level changed" notification too. | | |
| AS-27 | High-risk plant reaches the LGU | AS-17 gave High | Log in as LGU Officer → High Risk / Risks | — | Farmer A's plant is listed as High risk with the assessment details and photo. | | |
| AS-28 | Changing the device clock doesn't unlock early | AS-04 done today | Set the computer's date 8 days ahead, reload, try to submit | — | Still locked (409). Eligibility comes from the server date, not the browser. | | |

---

## Summary

| Module | Test Cases | Passed | Failed | Blocked |
|---|---|---|---|---|
| Crop Recommendation | 29 | | | |
| Add Plant | 22 | | | |
| Plant Assessment | 28 | | | |
| **Total** | **79** | | | |

**Tested by:** ____________________  **Date:** ____________________
