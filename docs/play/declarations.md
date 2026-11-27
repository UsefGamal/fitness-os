# Play Console answers (PLAY-1)

What to pick on each **App content** page (Play Console > Policy and programs > App content), and why. Every answer follows from how Tafra works: no server, no account, no ads, nothing sent off the phone. Re-check this page if that ever changes.

## Privacy policy

`https://github.com/UsefGamal/fitness-os/blob/main/PRIVACY.md`

## App access

**All functionality is available without any access restrictions.** There is no login.

## Ads

**No, my app does not contain ads.**

## Content rating (IARC questionnaire)

- Category: **All other app types**.
- Violence, fear, sexuality, language, controlled substances, crude humour, gambling: **No** to all.
- Can users interact or exchange content with each other? **No.**
- Does the app share the user's location with other users? **No.**
- Digital purchases? **No.**
- Expected result: Everyone / PEGI 3 / USK 0.

## Target audience and content

- Target age: **18 and over** only. (Calorie deficits and body-weight goals are adult topics; picking only 18+ also keeps the app out of the Families programme.)
- Could the app appeal to children by accident? **No.**

## Data safety

- Does your app collect or share any of the required user data types? **No.**
  - Play's definition: data that is processed only on the device and never sent off it is not "collected". Exports, backups and share copies happen only when the person picks where they go, which Play counts as user-initiated, not as sharing.
  - Health Connect data is read and written on the phone only.
- Because nothing is collected, the encryption-in-transit and deletion-request questions don't apply. (Delete everything is in the app anyway.)
- The listing will show **"No data collected"** and **"No data shared with third parties"**.

## Health apps declaration

- Health features: **Activity and fitness** (workout plans and tracking), **Nutrition and weight management** (calorie targets, meal plan, weight trend).
- Not a medical device; no diagnosis or treatment. The store description carries the "not medical advice" line.

## Health Connect permissions

Play asks for a reason per data type. Tafra only uses the data inside the app to show the person's own progress.

| Permission | Why |
| --- | --- |
| Read weight | Weigh-ins from a smart scale or another app appear in the user's weight trend and goal card. |
| Write exercise | Finished workouts are saved to Health Connect so other fitness apps can see them. |
| Read steps | Optional. Daily steps show on the Today card and, if the user turns it on, adjust the calorie target to their real activity. |
| Read active calories burned | Optional. Same as steps: activity-based calorie target, off by default. |
| Read sleep | Optional. A recovery hint on the Today card: under 6 hours, or 90 minutes under the user's usual (the median of the last 14 days), suggests an easier day. After a poor night the Stats body map keeps muscles "recovering" one extra day. Advice only: it never changes weights or the plan. |
| Read resting heart rate | Optional. Part of the same recovery hint: 5 beats a minute or more above the user's usual (the median of the last 14 days) suggests an easier day. Advice only. |

Each read is optional and the app works fully without Health Connect. The in-app explanation is the "Tafra and Health Connect" screen (`HealthPrivacyActivity`), linked from Health Connect's own settings.

## Foreground service (special use)

- Type: **specialUse**, for `RestTimerService`.
- What it does: a countdown between sets of a workout the user started, shown in the notification shade so the user can lock the phone and still hear and see when to start the next set. It stops when the rest ends or the workout finishes.
- Why no other type fits: it isn't media, location, health sensor, or a data sync, and a rest can run longer than the 3 minutes a short service allows.
- Video: record 20-30 seconds on the phone (start a workout, log a set, lock the phone, show the timer in the shade, it ends), upload it to YouTube as **Unlisted**, and paste the link.

## Alarms and notifications

- `SCHEDULE_EXACT_ALARM` comes with Capacitor's local notifications so workout and meal reminders come on time. Play only restricts `USE_EXACT_ALARM`, which Tafra doesn't use; the person can turn exact alarms off and reminders just come a little later.
- `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` was removed (Play limits it to a few kinds of app). The reminder check's Battery **Fix** opens Tafra's settings page instead.

## Other pages

- Government app: **No**. Financial features: **None**. News app: **No**. Health (COVID-19) contact tracing: **No**.
